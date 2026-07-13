import {
  convertToUsd,
  defaultRemindAt,
  DEFAULT_FX_RATES,
  parseObligationCreate,
  parseObligationSettle,
  parseObligationUpdate,
  type ObligationCreateInput,
  type ObligationSettleInput,
  type ObligationUpdateInput,
} from "@costmcp/core";
import {
  createServiceClient,
  deleteObligation,
  findProjectBySlug,
  getFxRates,
  getObligationById,
  insertObligation,
  listObligations,
  listUpcomingPayments,
  updateObligation,
  upsertProjectBySlug,
  upsertVendorByName,
  type ObligationRow,
  type UpcomingPayment,
} from "@costmcp/db";
import { persistWorkspaceCostMessage } from "@/lib/auth";

async function loadRates() {
  const client = createServiceClient();
  let rates = DEFAULT_FX_RATES;
  try {
    const dbRates = await getFxRates(client);
    if (Object.keys(dbRates).length) rates = { ...DEFAULT_FX_RATES, ...dbRates };
  } catch {
    // bundled rates
  }
  return rates;
}

async function resolveProjectId(
  workspaceId: string,
  projectSlug: string | null | undefined,
): Promise<string | null> {
  if (!projectSlug) return null;
  const client = createServiceClient();
  const project = await upsertProjectBySlug(client, workspaceId, projectSlug);
  return String(project.id);
}

async function resolveVendorId(
  workspaceId: string,
  vendorName: string | null | undefined,
): Promise<string | null> {
  if (!vendorName?.trim()) return null;
  const client = createServiceClient();
  const vendor = await upsertVendorByName(client, workspaceId, vendorName.trim());
  return String(vendor.id);
}

export async function createObligationRecord(
  workspaceId: string,
  raw: unknown,
): Promise<ObligationRow> {
  const input: ObligationCreateInput = parseObligationCreate(raw);
  const rates = await loadRates();
  const currency = (input.currency ?? "USD").toUpperCase();
  const amountUsd = convertToUsd(input.amount, currency, rates);
  const payee = input.payee.trim();
  const projectId = await resolveProjectId(workspaceId, input.project);
  const vendorId = await resolveVendorId(
    workspaceId,
    input.vendor?.trim() || undefined,
  );
  const remindAt = input.remind_at ?? defaultRemindAt(input.due_date);

  return insertObligation(createServiceClient(), {
    workspace_id: workspaceId,
    project_id: projectId,
    vendor_id: vendorId,
    payee,
    amount_original: input.amount,
    currency,
    amount_usd: amountUsd,
    due_date: input.due_date,
    remind_at: remindAt,
    status: "open",
    notes: input.notes ?? null,
    source: input.source,
  });
}

export async function updateObligationRecord(
  workspaceId: string,
  id: string,
  raw: unknown,
): Promise<ObligationRow> {
  const existing = await getObligationById(createServiceClient(), workspaceId, id);
  if (!existing) {
    throw Object.assign(new Error("Obligation not found"), { status: 404 });
  }

  const input: ObligationUpdateInput = parseObligationUpdate(raw);
  const rates = await loadRates();

  const patch: Parameters<typeof updateObligation>[3] = {};

  if (input.payee !== undefined) patch.payee = input.payee.trim();
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.status !== undefined) {
    if (input.status === "paid") {
      throw Object.assign(
        new Error("Use settle to mark an obligation paid"),
        { status: 400 },
      );
    }
    if (existing.status === "paid" && input.status !== "paid") {
      throw Object.assign(new Error("Paid obligations cannot change status here; void the expense instead"), {
        status: 400,
      });
    }
    patch.status = input.status;
    if (input.status === "cancelled") {
      patch.paid_at = null;
    }
  }

  const amount = input.amount ?? Number(existing.amount_original);
  const currency = (input.currency ?? existing.currency).toUpperCase();
  if (input.amount !== undefined || input.currency !== undefined) {
    patch.amount_original = amount;
    patch.currency = currency;
    patch.amount_usd = convertToUsd(amount, currency, rates);
  }

  if (input.due_date !== undefined) {
    patch.due_date = input.due_date;
    if (input.remind_at === undefined && !existing.remind_at) {
      patch.remind_at = defaultRemindAt(input.due_date);
    }
  }
  if (input.remind_at !== undefined) {
    patch.remind_at = input.remind_at;
  }

  if (input.project !== undefined) {
    patch.project_id = input.project
      ? await resolveProjectId(workspaceId, input.project)
      : null;
  }
  if (input.vendor !== undefined) {
    patch.vendor_id = input.vendor
      ? await resolveVendorId(workspaceId, input.vendor)
      : null;
    if (input.vendor && input.payee === undefined) {
      patch.payee = input.vendor.trim();
    }
  }

  const updated = await updateObligation(
    createServiceClient(),
    workspaceId,
    id,
    patch,
  );
  if (!updated) {
    throw Object.assign(new Error("Obligation not found"), { status: 404 });
  }
  return updated;
}

export async function cancelObligationRecord(
  workspaceId: string,
  id: string,
): Promise<ObligationRow> {
  const existing = await getObligationById(createServiceClient(), workspaceId, id);
  if (!existing) {
    throw Object.assign(new Error("Obligation not found"), { status: 404 });
  }
  if (existing.status === "paid") {
    throw Object.assign(new Error("Cannot cancel a paid obligation"), { status: 400 });
  }

  const updated = await updateObligation(createServiceClient(), workspaceId, id, {
    status: "cancelled",
  });
  if (!updated) {
    throw Object.assign(new Error("Obligation not found"), { status: 404 });
  }
  return updated;
}

export async function deleteObligationRecord(
  workspaceId: string,
  id: string,
): Promise<ObligationRow> {
  const existing = await getObligationById(createServiceClient(), workspaceId, id);
  if (!existing) {
    throw Object.assign(new Error("Obligation not found"), { status: 404 });
  }
  if (existing.status === "paid") {
    throw Object.assign(new Error("Cannot delete a paid obligation"), { status: 400 });
  }
  const deleted = await deleteObligation(createServiceClient(), workspaceId, id);
  if (!deleted) {
    throw Object.assign(new Error("Obligation not found"), { status: 404 });
  }
  return deleted;
}

export async function settleObligationRecord(
  workspaceId: string,
  id: string,
  raw: unknown,
): Promise<{ obligation: ObligationRow; expense: unknown }> {
  const client = createServiceClient();
  const existing = await getObligationById(client, workspaceId, id);
  if (!existing) {
    throw Object.assign(new Error("Obligation not found"), { status: 404 });
  }
  if (existing.status !== "open") {
    throw Object.assign(new Error("Only open obligations can be settled"), {
      status: 400,
    });
  }

  const input: ObligationSettleInput = parseObligationSettle(raw);

  let projectSlug = input.project;
  if (!projectSlug && existing.project_id) {
    const { data: project } = await client
      .from("projects")
      .select("slug")
      .eq("id", existing.project_id)
      .maybeSingle();
    projectSlug = project?.slug as string | undefined;
  }
  if (!projectSlug) {
    throw Object.assign(
      new Error("project is required to settle (set on the obligation or in the settle body)"),
      { status: 400 },
    );
  }

  // Ensure project exists / is allowed
  const project = await findProjectBySlug(client, workspaceId, projectSlug);
  if (!project) {
    await upsertProjectBySlug(client, workspaceId, projectSlug);
  }

  const expense = await persistWorkspaceCostMessage(workspaceId, {
    project: projectSlug,
    source: "manual",
    timestamp: input.occurred_at,
    message: {
      type: "expense",
      vendor: existing.payee,
      amount: Number(existing.amount_original),
      currency: existing.currency,
      category: input.category,
      expense_type: "invoice",
      notes:
        input.notes ??
        existing.notes ??
        `Settled obligation due ${existing.due_date}`,
      metadata: { obligation_id: existing.id },
    },
  });

  const obligation = await updateObligation(client, workspaceId, id, {
    status: "paid",
    paid_at: new Date().toISOString(),
    settled_message_id: String(expense.id),
  });
  if (!obligation) {
    throw Object.assign(new Error("Obligation not found after settle"), {
      status: 500,
    });
  }

  return { obligation, expense };
}

export async function listObligationRecords(
  workspaceId: string,
  opts?: { status?: string; dueBefore?: string; dueAfter?: string; limit?: number },
) {
  return listObligations(createServiceClient(), workspaceId, opts);
}

export async function listUpcomingPaymentRecords(
  workspaceId: string,
  opts?: { days?: number; includeOverdue?: boolean },
): Promise<UpcomingPayment[]> {
  return listUpcomingPayments(createServiceClient(), workspaceId, opts);
}

export function statusFromError(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    return Number((err as { status: number }).status) || 500;
  }
  return 500;
}
