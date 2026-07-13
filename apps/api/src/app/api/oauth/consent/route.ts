import { authenticateUser } from "@/lib/user-auth";
import {
  AUTH_CODE_TTL_SECONDS,
  OAUTH_SCOPES,
} from "@/lib/oauth/config";
import {
  createAuthorizationCode,
  findOrCreateConnection,
  getClient,
} from "@/lib/oauth/store";

// Called by the dashboard consent screen once the user approves. Authenticated
// with the user's Supabase session; mints a PKCE-bound authorization code scoped
// to the workspace the user selected, and returns the client redirect URL.
export async function POST(request: Request) {
  const auth = await authenticateUser(request);
  if (auth instanceof Response) return auth;

  let body: {
    client_id?: string;
    redirect_uri?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    scope?: string;
    state?: string;
    resource?: string;
    workspace_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { client_id, redirect_uri, code_challenge, workspace_id } = body;
  if (!client_id || !redirect_uri || !code_challenge || !workspace_id) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const client = await getClient(client_id);
  if (!client) {
    return Response.json({ error: "Unknown client" }, { status: 400 });
  }
  if (!client.redirect_uris.includes(redirect_uri)) {
    return Response.json({ error: "redirect_uri mismatch" }, { status: 400 });
  }

  // Verify the user is a member of the workspace they're granting access to.
  const { data: membership, error: memberError } = await auth.client
    .from("workspace_members")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  if (memberError) {
    return Response.json({ error: "Membership lookup failed" }, { status: 500 });
  }
  if (!membership) {
    return Response.json({ error: "Not a member of that workspace" }, { status: 403 });
  }

  const requested = (body.scope ?? "").split(/\s+/).filter(Boolean);
  const granted = new Set(requested.filter((s) => (OAUTH_SCOPES as readonly string[]).includes(s)));
  if (granted.size === 0) {
    for (const s of OAUTH_SCOPES) granted.add(s);
  } else if (body.resource) {
    // MCP OAuth: grant all supported scopes so connector tools (projects, subscriptions) work.
    for (const s of OAUTH_SCOPES) granted.add(s);
  }
  const scope = [...granted].join(" ");

  try {
    const connectionId = await findOrCreateConnection({
      clientId: client_id,
      clientName: client.client_name,
      userId: auth.user.id,
      workspaceId: workspace_id,
      scope,
    });

    const code = await createAuthorizationCode({
      clientId: client_id,
      userId: auth.user.id,
      workspaceId: workspace_id,
      redirectUri: redirect_uri,
      scope,
      resource: body.resource ?? null,
      codeChallenge: code_challenge,
      codeChallengeMethod: body.code_challenge_method ?? "S256",
      connectionId,
      ttlSeconds: AUTH_CODE_TTL_SECONDS,
    });

    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (body.state) url.searchParams.set("state", body.state);

    return Response.json({ redirect: url.toString() });
  } catch {
    return Response.json({ error: "Failed to authorize" }, { status: 500 });
  }
}
