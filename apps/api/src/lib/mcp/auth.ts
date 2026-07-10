import type { NextRequest } from "next/server";
import { authenticateRequest, type ApiKeyContext } from "@/lib/auth";
import { getMcpMetadataBase } from "@/lib/oauth/config";
import {
  connectionIsActive,
  findAccessToken,
  touchToken,
} from "@/lib/oauth/store";

export interface McpAuthContext extends ApiKeyContext {
  source: "oauth" | "api_key";
  connectionId?: string;
}

/**
 * Resolve the bearer credential on an MCP request. Accepts both OAuth 2.1 access
 * tokens (issued by our authorization server) and static `cmcp_` API keys.
 *
 * On failure returns a 401 carrying a RFC 9728 `WWW-Authenticate` challenge so
 * MCP clients can discover the authorization server and start the OAuth flow.
 */
export async function authenticateMcp(
  request: NextRequest,
): Promise<McpAuthContext | Response> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return unauthorized(request, "Missing bearer token");
  }

  const token = header.slice("Bearer ".length).trim();

  if (token.startsWith("cmcp_at_")) {
    try {
      const row = await findAccessToken(token);
      if (!row || row.revoked) {
        return unauthorized(request, "Invalid access token");
      }
      if (new Date(row.access_token_expires_at).getTime() < Date.now()) {
        return unauthorized(request, "Access token expired");
      }
      if (!(await connectionIsActive(row.connection_id))) {
        return unauthorized(request, "Connection revoked");
      }
      await touchToken(row.id, row.connection_id);
      return {
        source: "oauth",
        connectionId: row.connection_id,
        workspaceId: row.workspace_id,
        permissions: row.scope.split(/\s+/).filter(Boolean),
        projectId: null,
      };
    } catch {
      return unauthorized(request, "Authorization service unavailable");
    }
  }

  // Fall back to static API-key auth (allows pasting a key into a client config).
  const apiKeyAuth = await authenticateRequest(request);
  if (apiKeyAuth instanceof Response) {
    if (apiKeyAuth.status === 401) return unauthorized(request, "Invalid API key");
    return apiKeyAuth;
  }
  return { ...apiKeyAuth, source: "api_key" };
}

export function unauthorized(request: NextRequest, description: string): Response {
  const resourceMetadata = `${getMcpMetadataBase(request)}/.well-known/oauth-protected-resource`;
  return Response.json(
    { error: "invalid_token", error_description: description },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadata}", error="invalid_token", error_description="${description}"`,
      },
    },
  );
}
