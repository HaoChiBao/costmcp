import {
  listBankConnections,
  messageFromPlaidError,
  statusFromPlaidError,
} from "@/lib/plaid/service";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  try {
    const items = await listBankConnections(auth.workspaceId);
    return Response.json({ items });
  } catch (err) {
    return Response.json(
      { error: messageFromPlaidError(err) },
      { status: statusFromPlaidError(err) },
    );
  }
}
