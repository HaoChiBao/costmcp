import { parseCostMessage } from "@costmcp/core";

export type ManualLedgerBody = {
  project?: unknown;
  vendor?: unknown;
  amount?: unknown;
  currency?: unknown;
  category?: unknown;
  notes?: unknown;
  expense_type?: unknown;
  interval?: unknown;
  renewal_date?: unknown;
  status?: unknown;
  occurred_at?: unknown;
};

export function parseOccurredAt(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw Object.assign(new Error("occurred_at must be a string"), { status: 400 });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error("occurred_at must be a valid date/time"), { status: 400 });
  }
  return date.toISOString();
}

export function parseManualExpenseEnvelope(body: ManualLedgerBody) {
  const occurredAt = parseOccurredAt(body.occurred_at);
  return parseCostMessage({
    project: body.project,
    source: "manual",
    timestamp: occurredAt,
    message: {
      type: "expense",
      vendor: body.vendor,
      amount: body.amount,
      currency: typeof body.currency === "string" ? body.currency : "USD",
      category: typeof body.category === "string" ? body.category : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      expense_type:
        typeof body.expense_type === "string" ? body.expense_type : undefined,
    },
  });
}

export function parseManualSubscriptionEnvelope(body: ManualLedgerBody) {
  const occurredAt = parseOccurredAt(body.occurred_at);
  let renewalDate: string | undefined;
  if (typeof body.renewal_date === "string" && body.renewal_date.trim()) {
    const d = new Date(body.renewal_date);
    if (Number.isNaN(d.getTime())) {
      throw Object.assign(new Error("renewal_date must be a valid date/time"), {
        status: 400,
      });
    }
    renewalDate = d.toISOString();
  }

  return parseCostMessage({
    project: body.project,
    source: "manual",
    timestamp: occurredAt,
    message: {
      type: "subscription",
      vendor: body.vendor,
      amount: body.amount,
      currency: typeof body.currency === "string" ? body.currency : "USD",
      interval: body.interval,
      renewal_date: renewalDate,
      category: typeof body.category === "string" ? body.category : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
    },
  });
}
