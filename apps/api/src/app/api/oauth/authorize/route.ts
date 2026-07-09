import { NextResponse, type NextRequest } from "next/server";
import { getWebUrl } from "@/lib/oauth/config";
import { getClient } from "@/lib/oauth/store";

// OAuth 2.1 authorization endpoint. Validates the client's request, then hands off
// to the dashboard consent screen where the user logs in (Supabase) and picks a
// workspace. The actual authorization code is minted by /api/oauth/consent.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const responseType = searchParams.get("response_type");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? "S256";
  const scope = searchParams.get("scope") ?? "";
  const state = searchParams.get("state") ?? "";
  const resource = searchParams.get("resource") ?? "";

  if (!clientId || !redirectUri) {
    return htmlError("Missing client_id or redirect_uri");
  }

  let client;
  try {
    client = await getClient(clientId);
  } catch {
    return htmlError("Authorization service unavailable");
  }
  if (!client) {
    return htmlError("Unknown client_id");
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return htmlError("redirect_uri does not match the registered client");
  }

  // From here we can safely redirect errors back to the client.
  if (responseType !== "code") {
    return redirectError(redirectUri, "unsupported_response_type", state);
  }
  if (!codeChallenge) {
    return redirectError(redirectUri, "invalid_request", state, "code_challenge is required (PKCE)");
  }
  if (codeChallengeMethod !== "S256") {
    return redirectError(redirectUri, "invalid_request", state, "Only S256 code_challenge_method is supported");
  }

  const consentUrl = new URL(`${getWebUrl()}/oauth/consent`);
  consentUrl.searchParams.set("client_id", clientId);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("response_type", responseType);
  consentUrl.searchParams.set("code_challenge", codeChallenge);
  consentUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
  consentUrl.searchParams.set("scope", scope);
  consentUrl.searchParams.set("state", state);
  if (resource) consentUrl.searchParams.set("resource", resource);
  if (client.client_name) consentUrl.searchParams.set("client_name", client.client_name);

  return NextResponse.redirect(consentUrl.toString());
}

function redirectError(
  redirectUri: string,
  error: string,
  state: string,
  description?: string,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}

function htmlError(message: string): Response {
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem"><h1>Authorization error</h1><p>${message}</p></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
