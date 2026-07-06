import { getWorkspaceOrgTree } from "@costmcp/db";
import { authenticateUser } from "@/lib/user-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await authenticateUser(request);
  if (auth instanceof Response) return auth;

  const { slug } = await params;

  try {
    const tree = await getWorkspaceOrgTree(auth.client, slug, auth.user.id);
    if (!tree) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }
    return Response.json(tree);
  } catch {
    return Response.json({ error: "Failed to load organization" }, { status: 500 });
  }
}
