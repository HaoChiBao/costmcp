import type { NextRequest } from "next/server";
import { registerClient } from "@/lib/oauth/store";

// OAuth 2.0 Dynamic Client Registration (RFC 7591). MCP clients (Cursor, Claude,
// ChatGPT) call this to obtain a client_id before starting the auth code flow.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as unknown[]).filter((u): u is string => typeof u === "string")
    : [];

  if (redirectUris.length === 0) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: "At least one redirect_uri is required",
      },
      { status: 400 },
    );
  }

  const grantTypes = Array.isArray(body.grant_types)
    ? (body.grant_types as unknown[]).filter((g): g is string => typeof g === "string")
    : undefined;
  const responseTypes = Array.isArray(body.response_types)
    ? (body.response_types as unknown[]).filter((r): r is string => typeof r === "string")
    : undefined;

  const tokenEndpointAuthMethod =
    typeof body.token_endpoint_auth_method === "string"
      ? (body.token_endpoint_auth_method as string)
      : "none";

  try {
    const { clientId, clientSecret } = await registerClient({
      clientName: typeof body.client_name === "string" ? body.client_name : null,
      redirectUris,
      grantTypes,
      responseTypes,
      tokenEndpointAuthMethod,
      scope: typeof body.scope === "string" ? body.scope : null,
      logoUri: typeof body.logo_uri === "string" ? body.logo_uri : null,
      clientUri: typeof body.client_uri === "string" ? body.client_uri : null,
    });

    return Response.json(
      {
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        client_id_issued_at: Math.floor(Date.now() / 1000),
        ...(clientSecret ? { client_secret_expires_at: 0 } : {}),
        redirect_uris: redirectUris,
        grant_types: grantTypes ?? ["authorization_code", "refresh_token"],
        response_types: responseTypes ?? ["code"],
        token_endpoint_auth_method: tokenEndpointAuthMethod,
        ...(typeof body.client_name === "string" ? { client_name: body.client_name } : {}),
      },
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: "server_error", error_description: "Failed to register client" },
      { status: 500 },
    );
  }
}
