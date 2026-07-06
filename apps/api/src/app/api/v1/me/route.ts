import { getUserProfile, getUserWorkspaces } from "@costmcp/db";
import { authenticateUser } from "@/lib/user-auth";

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth instanceof Response) return auth;

  try {
    const [profile, workspaces] = await Promise.all([
      getUserProfile(auth.client, auth.user.id),
      getUserWorkspaces(auth.client, auth.user.id),
    ]);

    return Response.json({
      user: {
        id: auth.user.id,
        email: auth.user.email,
      },
      profile,
      workspaces: workspaces.map(({ workspace, role }) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type,
        description: workspace.description,
        base_currency: workspace.base_currency,
        role,
      })),
    });
  } catch {
    return Response.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
