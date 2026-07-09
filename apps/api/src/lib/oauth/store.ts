// Storage layer for the OAuth 2.1 authorization server. These tables were added
// after the generated Database types, so we use an untyped service client here to
// keep the rest of the app strictly typed while these rows stay internal.

import { createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function oauthDb(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

/** Verify a PKCE code_verifier against a stored S256 challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface OAuthClient {
  client_id: string;
  client_secret_hash: string | null;
  client_name: string | null;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string | null;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await oauthDb()
    .from("oauth_clients")
    .select(
      "client_id, client_secret_hash, client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method, scope",
    )
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return (data as OAuthClient | null) ?? null;
}

export interface RegisterClientInput {
  clientName?: string | null;
  redirectUris: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scope?: string | null;
  logoUri?: string | null;
  clientUri?: string | null;
}

export async function registerClient(input: RegisterClientInput) {
  const clientId = randomToken("cmcp_client_");
  const isConfidential =
    (input.tokenEndpointAuthMethod ?? "none") !== "none";
  const clientSecret = isConfidential ? randomToken("cmcp_secret_") : null;

  const row = {
    client_id: clientId,
    client_secret_hash: clientSecret ? sha256(clientSecret) : null,
    client_name: input.clientName ?? null,
    redirect_uris: input.redirectUris,
    grant_types: input.grantTypes ?? ["authorization_code", "refresh_token"],
    response_types: input.responseTypes ?? ["code"],
    token_endpoint_auth_method: input.tokenEndpointAuthMethod ?? "none",
    scope: input.scope ?? null,
    logo_uri: input.logoUri ?? null,
    client_uri: input.clientUri ?? null,
  };

  const { error } = await oauthDb().from("oauth_clients").insert(row);
  if (error) throw error;

  return { clientId, clientSecret, row };
}

export async function createAuthorizationCode(params: {
  clientId: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  scope: string;
  resource: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
  connectionId: string;
  ttlSeconds: number;
}): Promise<string> {
  const code = randomToken("cmcp_code_");
  const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000).toISOString();
  const { error } = await oauthDb().from("oauth_authorization_codes").insert({
    code_hash: sha256(code),
    client_id: params.clientId,
    connection_id: params.connectionId,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    resource: params.resource,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return code;
}

export interface AuthCodeRow {
  code_hash: string;
  client_id: string;
  connection_id: string | null;
  user_id: string;
  workspace_id: string;
  redirect_uri: string;
  scope: string;
  resource: string | null;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: string;
  consumed: boolean;
}

export async function consumeAuthorizationCode(code: string): Promise<AuthCodeRow | null> {
  const codeHash = sha256(code);
  const { data, error } = await oauthDb()
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;
  const row = data as AuthCodeRow | null;
  if (!row) return null;

  // Mark consumed regardless of validity to prevent replay.
  await oauthDb()
    .from("oauth_authorization_codes")
    .update({ consumed: true })
    .eq("code_hash", codeHash);

  if (row.consumed) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export async function findOrCreateConnection(params: {
  clientId: string;
  clientName: string | null;
  userId: string;
  workspaceId: string;
  scope: string;
}): Promise<string> {
  const db = oauthDb();
  const { data: existing, error } = await db
    .from("mcp_connections")
    .select("id")
    .eq("client_id", params.clientId)
    .eq("user_id", params.userId)
    .eq("workspace_id", params.workspaceId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    await db
      .from("mcp_connections")
      .update({ scope: params.scope, client_name: params.clientName })
      .eq("id", (existing as { id: string }).id);
    return (existing as { id: string }).id;
  }

  const { data: created, error: insertError } = await db
    .from("mcp_connections")
    .insert({
      client_id: params.clientId,
      client_name: params.clientName,
      user_id: params.userId,
      workspace_id: params.workspaceId,
      scope: params.scope,
      status: "active",
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return (created as { id: string }).id;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

export async function issueTokens(params: {
  connectionId: string;
  clientId: string;
  userId: string;
  workspaceId: string;
  scope: string;
  resource: string | null;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}): Promise<IssuedTokens> {
  const accessToken = randomToken("cmcp_at_");
  const refreshToken = randomToken("cmcp_rt_");
  const now = Date.now();

  const { error } = await oauthDb().from("oauth_tokens").insert({
    connection_id: params.connectionId,
    client_id: params.clientId,
    user_id: params.userId,
    workspace_id: params.workspaceId,
    access_token_hash: sha256(accessToken),
    refresh_token_hash: sha256(refreshToken),
    scope: params.scope,
    resource: params.resource,
    access_token_expires_at: new Date(now + params.accessTtlSeconds * 1000).toISOString(),
    refresh_token_expires_at: new Date(now + params.refreshTtlSeconds * 1000).toISOString(),
  });
  if (error) throw error;

  return {
    accessToken,
    refreshToken,
    expiresIn: params.accessTtlSeconds,
    scope: params.scope,
  };
}

export interface TokenRow {
  id: string;
  connection_id: string;
  client_id: string;
  user_id: string;
  workspace_id: string;
  scope: string;
  resource: string | null;
  access_token_expires_at: string;
  refresh_token_expires_at: string | null;
  revoked: boolean;
}

export async function findAccessToken(accessToken: string): Promise<TokenRow | null> {
  const { data, error } = await oauthDb()
    .from("oauth_tokens")
    .select(
      "id, connection_id, client_id, user_id, workspace_id, scope, resource, access_token_expires_at, refresh_token_expires_at, revoked",
    )
    .eq("access_token_hash", sha256(accessToken))
    .maybeSingle();
  if (error) throw error;
  return (data as TokenRow | null) ?? null;
}

export async function findRefreshToken(refreshToken: string): Promise<TokenRow | null> {
  const { data, error } = await oauthDb()
    .from("oauth_tokens")
    .select(
      "id, connection_id, client_id, user_id, workspace_id, scope, resource, access_token_expires_at, refresh_token_expires_at, revoked",
    )
    .eq("refresh_token_hash", sha256(refreshToken))
    .maybeSingle();
  if (error) throw error;
  return (data as TokenRow | null) ?? null;
}

export async function rotateRefreshToken(tokenId: string): Promise<void> {
  await oauthDb().from("oauth_tokens").update({ revoked: true }).eq("id", tokenId);
}

export async function connectionIsActive(connectionId: string): Promise<boolean> {
  const { data, error } = await oauthDb()
    .from("mcp_connections")
    .select("status")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as { status: string } | null)?.status === "active";
}

export async function touchToken(tokenId: string, connectionId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  await Promise.all([
    oauthDb().from("oauth_tokens").update({ last_used_at: nowIso }).eq("id", tokenId),
    oauthDb().from("mcp_connections").update({ last_used_at: nowIso }).eq("id", connectionId),
  ]);
}

export function verifyClientSecret(secret: string, hash: string | null): boolean {
  if (!hash) return false;
  const a = Buffer.from(sha256(secret));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Re-exported so route handlers can sign short-lived state if needed later.
export function hmac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
