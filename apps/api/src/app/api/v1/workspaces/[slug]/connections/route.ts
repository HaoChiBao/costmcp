import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { oauthDb } from "@/lib/oauth/store";

// List MCP client connections (OAuth grants) authorized for this workspace.
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const { data, error } = await oauthDb()
    .from("mcp_connections")
    .select("id, client_id, client_name, scope, status, created_at, last_used_at")
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to load connections" }, { status: 500 });
  }
  return Response.json({ connections: data ?? [] });
}
