import {
  disconnectItem,
  messageFromPlaidError,
  statusFromPlaidError,
} from "@/lib/plaid/service";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  try {
    const item = await disconnectItem(auth.workspaceId, id);
    return Response.json({ item });
  } catch (err) {
    return Response.json(
      { error: messageFromPlaidError(err) },
      { status: statusFromPlaidError(err) },
    );
  }
}
