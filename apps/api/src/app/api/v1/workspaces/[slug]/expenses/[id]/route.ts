import {
  updateWorkspaceLedgerMessage,
  voidWorkspaceLedgerMessage,
} from "@/lib/auth";
import {
  parseManualExpenseEnvelope,
  parseManualSubscriptionEnvelope,
  type ManualLedgerBody,
} from "@/lib/manual-ledger";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { getCostMessageById, createServiceClient } from "@costmcp/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: ManualLedgerBody;
  try {
    body = (await request.json()) as ManualLedgerBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = createServiceClient();
  const existing = await getCostMessageById(client, auth.workspaceId, id);
  if (!existing || existing.voided_at) {
    return Response.json({ error: "Record not found" }, { status: 404 });
  }
  if (
    existing.message_type !== "expense" &&
    existing.message_type !== "subscription"
  ) {
    return Response.json(
      { error: "Only expenses and subscriptions can be edited here" },
      { status: 400 },
    );
  }

  let envelope;
  try {
    envelope =
      existing.message_type === "subscription"
        ? parseManualSubscriptionEnvelope(body)
        : parseManualExpenseEnvelope(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 400;
    return Response.json({ error: message }, { status });
  }

  try {
    const row = await updateWorkspaceLedgerMessage(auth.workspaceId, id, envelope);
    return Response.json({ expense: row });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Failed to update";
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  try {
    const row = await voidWorkspaceLedgerMessage(auth.workspaceId, id);
    return Response.json({ voided: row });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Failed to delete";
    return Response.json({ error: message }, { status });
  }
}
