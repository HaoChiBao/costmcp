import type { NextRequest } from "next/server";
import { authorizationServerMetadata } from "@/lib/oauth/config";

// OAuth 2.0 Authorization Server Metadata (RFC 8414).
// Served at /.well-known/oauth-authorization-server via next.config rewrite.
export function GET(request: NextRequest) {
  return Response.json(authorizationServerMetadata(request), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
