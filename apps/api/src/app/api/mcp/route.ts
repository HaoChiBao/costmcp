import type { NextRequest } from "next/server";
import { authenticateMcp } from "@/lib/mcp/auth";
import { dispatch } from "@/lib/mcp/handler";

// Remote MCP server endpoint (Streamable HTTP, stateless JSON mode). MCP clients
// POST JSON-RPC requests here with an OAuth bearer token (or a cmcp_ API key).
export async function POST(request: NextRequest) {
  const auth = await authenticateMcp(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  // Batch requests.
  if (Array.isArray(body)) {
    const responses = [];
    for (const message of body) {
      const res = await dispatch(auth, message);
      if (res) responses.push(res);
    }
    if (responses.length === 0) {
      return new Response(null, { status: 202 });
    }
    return Response.json(responses);
  }

  const response = await dispatch(auth, body as Record<string, unknown>);
  if (!response) {
    // Notification only — acknowledge with 202 and no body.
    return new Response(null, { status: 202 });
  }
  return Response.json(response);
}

// Streamable HTTP GET opens a server->client SSE stream. We run stateless, so we
// don't support it, but we still emit the 401 challenge when unauthenticated so
// clients can discover the authorization server.
export async function GET(request: NextRequest) {
  const auth = await authenticateMcp(request);
  if (auth instanceof Response) return auth;
  return methodNotAllowed();
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateMcp(request);
  if (auth instanceof Response) return auth;
  return new Response(null, { status: 204 });
}

function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({ error: "method_not_allowed" }),
    { status: 405, headers: { Allow: "POST, DELETE", "Content-Type": "application/json" } },
  );
}
