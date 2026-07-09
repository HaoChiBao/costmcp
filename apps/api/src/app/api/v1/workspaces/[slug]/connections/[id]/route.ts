import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { oauthDb } from "@/lib/oauth/store";

// Revoke an MCP connection: mark it revoked and invalidate all of its tokens.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const db = oauthDb();

  const { data: connection, error: lookupError } = await db
    .from("mcp_connections")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (lookupError) {
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!connection) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  const { error: revokeError } = await db
    .from("mcp_connections")
    .update({ status: "revoked" })
    .eq("id", id);
  if (revokeError) {
    return Response.json({ error: "Failed to revoke connection" }, { status: 500 });
  }

  await db.from("oauth_tokens").update({ revoked: true }).eq("connection_id", id);

  return Response.json({ ok: true });
}
