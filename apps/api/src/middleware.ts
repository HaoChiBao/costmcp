import { NextRequest, NextResponse } from "next/server";
import { corsHeaders, resolveCorsOrigin } from "@/lib/cors";

function hostname(request: NextRequest): string {
  const raw =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  return (raw.split(":")[0] ?? raw).toLowerCase();
}

function isMcpHostname(host: string): boolean {
  return host === "mcp.costmcp.com" || host.startsWith("mcp.");
}

function applyCors(response: NextResponse, origin: string | null): NextResponse {
  const headers = corsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * - CORS for all /api routes
 * - On mcp.* hosts: rewrite `/` (and `/mcp`) → `/api/mcp` so agents can use
 *   https://mcp.costmcp.com as the MCP server URL
 */
export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = hostname(request);
  const { pathname } = request.nextUrl;

  if (isMcpHostname(host)) {
    if (request.method === "OPTIONS") {
      if (!resolveCorsOrigin(origin)) {
        return new NextResponse(null, { status: 403 });
      }
      return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Dedicated MCP host: root (and /mcp) are the Streamable HTTP endpoint.
    if (pathname === "/" || pathname === "/mcp") {
      const url = request.nextUrl.clone();
      url.pathname = "/api/mcp";
      return applyCors(NextResponse.rewrite(url), origin);
    }

    // Let /.well-known/* and /api/* fall through (rewrites / route handlers).
    if (pathname.startsWith("/.well-known") || pathname.startsWith("/api/")) {
      return applyCors(NextResponse.next(), origin);
    }

    // Anything else on the MCP host → MCP endpoint (clients sometimes append paths).
    const url = request.nextUrl.clone();
    url.pathname = "/api/mcp";
    return applyCors(NextResponse.rewrite(url), origin);
  }

  // Default API host CORS for /api/*
  if (request.method === "OPTIONS") {
    if (!resolveCorsOrigin(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  return applyCors(NextResponse.next(), origin);
}

export const config = {
  matcher: ["/", "/mcp", "/mcp/:path*", "/api/:path*", "/.well-known/:path*"],
};
