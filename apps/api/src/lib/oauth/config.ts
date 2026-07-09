// Central configuration + discovery-document builders for the MCP OAuth 2.1
// authorization server. The MCP endpoint is the protected resource; this same
// Next.js app also plays the authorization-server role.

export const OAUTH_SCOPES = [
  "log_usage",
  "add_expenses",
  "read_summaries",
  "estimate_costs",
] as const;

export const DEFAULT_SCOPE = OAUTH_SCOPES.join(" ");

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_SECONDS = 60 * 5; // 5 minutes

/** Public origin of this API (the OAuth issuer + resource server host). */
export function getBaseUrl(request: Request): string {
  const envUrl = process.env.COSTMCP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

/** Origin of the web dashboard, where interactive login + consent happens. */
export function getWebUrl(): string {
  return (process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}

/** Canonical URL of the MCP endpoint (the OAuth "resource"). */
export function getMcpResourceUrl(request: Request): string {
  return `${getBaseUrl(request)}/api/mcp`;
}

export function authorizationServerMetadata(request: Request) {
  const base = getBaseUrl(request);
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...OAUTH_SCOPES],
    service_documentation: `${getWebUrl()}/docs`,
  };
}

export function protectedResourceMetadata(request: Request) {
  const base = getBaseUrl(request);
  return {
    resource: getMcpResourceUrl(request),
    authorization_servers: [base],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "CostMCP",
    resource_documentation: `${getWebUrl()}/docs`,
  };
}
