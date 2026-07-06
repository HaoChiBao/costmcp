import { createUserClient } from "@costmcp/db";

export async function authenticateUser(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  const token = header.slice("Bearer ".length).trim();
  if (token.startsWith("cmcp_")) {
    return Response.json({ error: "API keys cannot access user endpoints" }, { status: 403 });
  }

  try {
    const client = createUserClient(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }
    return { client, user: data.user };
  } catch {
    return Response.json({ error: "Auth service unavailable" }, { status: 503 });
  }
}
