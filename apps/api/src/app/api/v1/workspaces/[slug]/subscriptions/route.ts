import { persistWorkspaceCostMessage } from "@/lib/auth";
import {
  parseManualSubscriptionEnvelope,
  type ManualLedgerBody,
} from "@/lib/manual-ledger";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: ManualLedgerBody;
  try {
    body = (await request.json()) as ManualLedgerBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let envelope;
  try {
    envelope = parseManualSubscriptionEnvelope(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid subscription payload";
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 400;
    return Response.json({ error: message }, { status });
  }

  try {
    const row = await persistWorkspaceCostMessage(auth.workspaceId, envelope);
    return Response.json({ subscription: row }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to add subscription";
    return Response.json({ error: message }, { status: 500 });
  }
}
