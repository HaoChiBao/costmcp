import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { oauthDb } from "@/lib/oauth/store";

// Revoke (soft-delete) an API key scoped to the caller's workspace.
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const { error } = await oauthDb()
    .from("api_keys")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return Response.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
