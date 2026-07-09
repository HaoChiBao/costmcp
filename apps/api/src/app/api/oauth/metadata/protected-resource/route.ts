import type { NextRequest } from "next/server";
import { protectedResourceMetadata } from "@/lib/oauth/config";

// OAuth 2.0 Protected Resource Metadata (RFC 9728).
// Served at /.well-known/oauth-protected-resource via next.config rewrite.
export function GET(request: NextRequest) {
  return Response.json(protectedResourceMetadata(request), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
