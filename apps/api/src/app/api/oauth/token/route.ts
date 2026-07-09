import type { NextRequest } from "next/server";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/lib/oauth/config";
import {
  connectionIsActive,
  consumeAuthorizationCode,
  findRefreshToken,
  getClient,
  issueTokens,
  rotateRefreshToken,
  verifyClientSecret,
  verifyPkce,
} from "@/lib/oauth/store";

// OAuth 2.1 token endpoint. Supports authorization_code (with PKCE) and
// refresh_token grants. Accepts form-encoded or JSON bodies.
export async function POST(request: NextRequest) {
  const params = await parseBody(request);
  const grantType = params.get("grant_type");

  if (grantType === "authorization_code") {
    return handleAuthorizationCode(params);
  }
  if (grantType === "refresh_token") {
    return handleRefreshToken(params);
  }
  return oauthError("unsupported_grant_type", "Unsupported grant_type", 400);
}

async function handleAuthorizationCode(params: URLSearchParams): Promise<Response> {
  const code = params.get("code");
  const clientId = params.get("client_id");
  const codeVerifier = params.get("code_verifier");
  const redirectUri = params.get("redirect_uri");

  if (!code || !clientId || !codeVerifier) {
    return oauthError("invalid_request", "Missing code, client_id, or code_verifier", 400);
  }

  const client = await getClient(clientId);
  if (!client) return oauthError("invalid_client", "Unknown client", 401);

  if (client.token_endpoint_auth_method !== "none") {
    const secret = params.get("client_secret");
    if (!secret || !verifyClientSecret(secret, client.client_secret_hash)) {
      return oauthError("invalid_client", "Invalid client credentials", 401);
    }
  }

  const row = await consumeAuthorizationCode(code);
  if (!row) return oauthError("invalid_grant", "Authorization code invalid or expired", 400);
  if (row.client_id !== clientId) {
    return oauthError("invalid_grant", "Code was issued to a different client", 400);
  }
  if (redirectUri && row.redirect_uri !== redirectUri) {
    return oauthError("invalid_grant", "redirect_uri mismatch", 400);
  }
  if (!verifyPkce(codeVerifier, row.code_challenge)) {
    return oauthError("invalid_grant", "PKCE verification failed", 400);
  }
  if (!row.connection_id) {
    return oauthError("invalid_grant", "Authorization code is not linked to a connection", 400);
  }

  try {
    const tokens = await issueTokens({
      connectionId: row.connection_id,
      clientId,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      scope: row.scope,
      resource: row.resource,
      accessTtlSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlSeconds: REFRESH_TOKEN_TTL_SECONDS,
    });
    return tokenResponse(tokens);
  } catch {
    return oauthError("server_error", "Failed to issue token", 500);
  }
}

async function handleRefreshToken(params: URLSearchParams): Promise<Response> {
  const refreshToken = params.get("refresh_token");
  const clientId = params.get("client_id");
  if (!refreshToken || !clientId) {
    return oauthError("invalid_request", "Missing refresh_token or client_id", 400);
  }

  const client = await getClient(clientId);
  if (!client) return oauthError("invalid_client", "Unknown client", 401);
  if (client.token_endpoint_auth_method !== "none") {
    const secret = params.get("client_secret");
    if (!secret || !verifyClientSecret(secret, client.client_secret_hash)) {
      return oauthError("invalid_client", "Invalid client credentials", 401);
    }
  }

  const row = await findRefreshToken(refreshToken);
  if (!row || row.revoked) {
    return oauthError("invalid_grant", "Refresh token invalid or revoked", 400);
  }
  if (row.client_id !== clientId) {
    return oauthError("invalid_grant", "Refresh token was issued to a different client", 400);
  }
  if (row.refresh_token_expires_at && new Date(row.refresh_token_expires_at).getTime() < Date.now()) {
    return oauthError("invalid_grant", "Refresh token expired", 400);
  }
  if (!(await connectionIsActive(row.connection_id))) {
    return oauthError("invalid_grant", "Connection has been revoked", 400);
  }

  try {
    // Rotate: revoke the presented token family entry, issue a fresh pair.
    await rotateRefreshToken(row.id);
    const tokens = await issueTokens({
      connectionId: row.connection_id,
      clientId,
      userId: row.user_id,
      workspaceId: row.workspace_id,
      scope: row.scope,
      resource: row.resource,
      accessTtlSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlSeconds: REFRESH_TOKEN_TTL_SECONDS,
    });
    return tokenResponse(tokens);
  } catch {
    return oauthError("server_error", "Failed to refresh token", 500);
  }
}

async function parseBody(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const json = (await request.json()) as Record<string, unknown>;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") params.set(key, value);
      }
      return params;
    } catch {
      return new URLSearchParams();
    }
  }
  const text = await request.text();
  return new URLSearchParams(text);
}

function tokenResponse(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}): Response {
  return Response.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}

function oauthError(error: string, description: string, status: number): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
