import type { NextRequest } from "next/server";
import {
  authenticateRequest,
  requirePermission,
} from "@/lib/auth";
import {
  subscriptionFromRow,
  updateSubscriptionMessage,
  type SubscriptionUpdateInput,
} from "@/lib/subscription-ledger";
import { createServiceClient, getCostMessageById } from "@costmcp/db";

type UpdateBody = SubscriptionUpdateInput;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "manage_subscriptions");
  if (denied) return denied;

  const { id } = await context.params;

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasUpdate = [
    body.amount,
    body.currency,
    body.interval,
    body.category,
    body.notes,
    body.status,
    body.renewal_date,
    body.started_at,
    body.occurred_at,
    body.timestamp,
    body.vendor,
    body.project,
  ].some((v) => v !== undefined);

  if (!hasUpdate) {
    return Response.json({ error: "At least one field to update is required" }, { status: 400 });
  }

  try {
    const result = await updateSubscriptionMessage(auth, { ...body, id });
    const client = createServiceClient();
    const row = await getCostMessageById(client, auth.workspaceId, id);
    if (!row) {
      return Response.json(result);
    }
    const { data: project } = await client
      .from("projects")
      .select("slug, name")
      .eq("id", row.project_id as string)
      .maybeSingle();

    return Response.json({
      ...result,
      subscription: subscriptionFromRow({
        id: row.id as string,
        amount_usd: Number(row.amount_usd),
        amount_original: row.amount_original as number | null,
        currency: row.currency as string,
        occurred_at: row.occurred_at as string,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        projects: project ? { slug: project.slug, name: project.name } : null,
      }),
    });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Failed to update subscription";
    return Response.json({ error: message }, { status });
  }
}
