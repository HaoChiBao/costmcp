import {
  createLinkToken,
  messageFromPlaidError,
  statusFromPlaidError,
} from "@/lib/plaid/service";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: { item_id?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as { item_id?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await createLinkToken({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      plaidItemRowId: body.item_id,
    });
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: messageFromPlaidError(err) },
      { status: statusFromPlaidError(err) },
    );
  }
}
