import {
  listBankTransactions,
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

  const url = new URL(request.url);
  const itemId = url.searchParams.get("item_id") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  try {
    const transactions = await listBankTransactions(auth.workspaceId, {
      itemId,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
    });
    return Response.json({ transactions });
  } catch (err) {
    return Response.json(
      { error: messageFromPlaidError(err) },
      { status: statusFromPlaidError(err) },
    );
  }
}
