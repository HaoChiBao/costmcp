// Central configuration + discovery-document builders for the MCP OAuth 2.1
// authorization server. The MCP endpoint is the protected resource; this same
// Next.js app also plays the authorization-server role.

export const OAUTH_SCOPES = [
  "log_usage",
  "add_expenses",
  "read_summaries",
  "estimate_costs",
  "manage_projects",
] as const;

export const DEFAULT_SCOPE = OAUTH_SCOPES.join(" ");

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_SECONDS = 60 * 5; // 5 minutes

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(/:$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

/** True when the request is on the dedicated MCP hostname (mcp.*). */
export function isMcpHost(request: Request): boolean {
  const raw =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  const host = (raw.split(":")[0] ?? raw).toLowerCase();
  return host === "mcp.costmcp.com" || host.startsWith("mcp.");
}

/** Public origin of the API / OAuth issuer (always api.costmcp.com in prod). */
export function getBaseUrl(request: Request): string {
  const envUrl = process.env.COSTMCP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return stripTrailingSlash(envUrl);
  return requestOrigin(request);
}

/** Origin of the web dashboard, where interactive login + consent happens. */
export function getWebUrl(): string {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001");
}

/**
 * Canonical URL of the MCP endpoint (the OAuth "resource").
 * Prefer COSTMCP_MCP_URL (e.g. https://mcp.costmcp.com); fall back to /api/mcp on the API host.
 */
export function getMcpResourceUrl(request: Request): string {
  const envUrl = process.env.COSTMCP_MCP_URL;
  if (envUrl) return stripTrailingSlash(envUrl);

  if (isMcpHost(request)) {
    return requestOrigin(request);
  }

  return `${getBaseUrl(request)}/api/mcp`;
}

/** Host used for WWW-Authenticate resource_metadata (prefer the MCP host when set). */
export function getMcpMetadataBase(request: Request): string {
  const envUrl = process.env.COSTMCP_MCP_URL;
  if (envUrl) return stripTrailingSlash(envUrl);
  if (isMcpHost(request)) return requestOrigin(request);
  return getBaseUrl(request);
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
