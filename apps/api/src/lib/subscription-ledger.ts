import { parseCostMessage, parseOptionalIsoDateTime, type CostMessageEnvelope } from "@costmcp/core";
import {
  createServiceClient,
  findLatestSubscriptionByVendor,
  findProjectBySlug,
  getCostMessageById,
} from "@costmcp/db";
import {
  assertProjectAccess,
  updateWorkspaceLedgerMessage,
  type ApiKeyContext,
} from "@/lib/auth";

export type SubscriptionUpdateInput = {
  id?: string;
  project?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  interval?: "monthly" | "yearly" | "weekly" | "quarterly";
  category?: string;
  notes?: string;
  status?: "active" | "trial" | "paused" | "cancelled";
  renewal_date?: string;
  started_at?: string;
  occurred_at?: string;
  timestamp?: string;
};

function metaString(meta: Record<string, unknown> | null, key: string): string | undefined {
  const value = meta?.[key];
  return typeof value === "string" ? value : undefined;
}

function buildSubscriptionEnvelope(
  projectSlug: string,
  existing: NonNullable<Awaited<ReturnType<typeof getCostMessageById>>>,
  patch: SubscriptionUpdateInput,
): CostMessageEnvelope {
  const meta = (existing.metadata as Record<string, unknown> | null) ?? {};
  const occurredAt =
    patch.started_at ??
    patch.occurred_at ??
    patch.timestamp ??
    (existing.occurred_at as string);

  const renewalRaw = patch.renewal_date ?? metaString(meta, "renewal_date");
  const renewalDate = renewalRaw ? parseOptionalIsoDateTime(renewalRaw) : undefined;

  return parseCostMessage({
    project: projectSlug,
    source: (existing.source as "api" | "mcp" | "manual" | "import") ?? "mcp",
    timestamp: occurredAt ? parseOptionalIsoDateTime(occurredAt) : undefined,
    message: {
      type: "subscription",
      vendor: patch.vendor ?? metaString(meta, "vendor") ?? "",
      amount: patch.amount ?? Number(existing.amount_original ?? existing.amount_usd ?? 0),
      currency: patch.currency ?? (existing.currency as string) ?? "USD",
      interval: (patch.interval ??
        metaString(meta, "interval") ??
        "monthly") as "monthly" | "yearly" | "weekly" | "quarterly",
      category: patch.category ?? metaString(meta, "category"),
      notes: patch.notes ?? metaString(meta, "notes"),
      status: (patch.status ??
        metaString(meta, "status") ??
        "active") as "active" | "trial" | "paused" | "cancelled",
      renewal_date: renewalDate,
    },
  });
}

export async function resolveSubscriptionMessageId(
  workspaceId: string,
  input: Pick<SubscriptionUpdateInput, "id" | "project" | "vendor">,
): Promise<{ id: string; projectSlug: string }> {
  const client = createServiceClient();

  if (input.id) {
    const existing = await getCostMessageById(client, workspaceId, input.id);
    if (!existing || existing.voided_at || existing.message_type !== "subscription") {
      throw Object.assign(new Error("Subscription not found"), { status: 404 });
    }
    if (!existing.project_id) {
      throw Object.assign(new Error("Subscription has no project"), { status: 400 });
    }
    const { data: project } = await client
      .from("projects")
      .select("slug")
      .eq("id", existing.project_id)
      .maybeSingle();
    if (!project?.slug) {
      throw Object.assign(new Error("Project not found"), { status: 404 });
    }
    return { id: input.id, projectSlug: project.slug };
  }

  const projectSlug = input.project?.trim() ?? "";
  const vendor = input.vendor?.trim() ?? "";
  if (!projectSlug || !vendor) {
    throw Object.assign(new Error("id or (project and vendor) is required"), { status: 400 });
  }

  const project = await findProjectBySlug(client, workspaceId, projectSlug);
  if (!project) {
    throw Object.assign(new Error("Project not found"), { status: 404 });
  }

  const existing = await findLatestSubscriptionByVendor(
    client,
    workspaceId,
    project.id,
    vendor,
  );
  if (!existing) {
    throw Object.assign(new Error(`Subscription not found for vendor "${vendor}"`), {
      status: 404,
    });
  }

  return { id: existing.id as string, projectSlug };
}

export async function updateSubscriptionMessage(
  ctx: ApiKeyContext,
  input: SubscriptionUpdateInput,
) {
  const { id, projectSlug } = await resolveSubscriptionMessageId(ctx.workspaceId, input);
  const client = createServiceClient();
  const existing = await getCostMessageById(client, ctx.workspaceId, id);
  if (!existing || existing.voided_at || existing.message_type !== "subscription") {
    throw Object.assign(new Error("Subscription not found"), { status: 404 });
  }

  const project = await findProjectBySlug(client, ctx.workspaceId, projectSlug);
  if (!project) {
    throw Object.assign(new Error("Project not found"), { status: 404 });
  }

  const denied = assertProjectAccess(ctx, project);
  if (denied) throw Object.assign(new Error("Forbidden by API key conditions"), { status: 403 });

  const envelope = buildSubscriptionEnvelope(projectSlug, existing, input);
  const updated = await updateWorkspaceLedgerMessage(ctx.workspaceId, id, envelope);
  return { subscription: updated, updated: true };
}

export function subscriptionFromRow(row: {
  id: string;
  amount_usd: number;
  amount_original: number | null;
  currency: string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  projects: { slug: string; name: string } | null;
}) {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    project: row.projects?.slug ?? null,
    project_name: row.projects?.name ?? null,
    vendor: metaString(meta, "vendor") ?? null,
    amount: row.amount_original ?? row.amount_usd,
    currency: row.currency,
    interval: metaString(meta, "interval") ?? null,
    status: metaString(meta, "status") ?? null,
    renewal_date: metaString(meta, "renewal_date") ?? null,
    notes: metaString(meta, "notes") ?? null,
    category: metaString(meta, "category") ?? null,
    occurred_at: row.occurred_at,
    amount_usd: row.amount_usd,
  };
}
