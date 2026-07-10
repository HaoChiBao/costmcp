import { createHash, timingSafeEqual } from "node:crypto";
import {
  createServiceClient,
  findCategoryBySlugOrName,
  findMessageByIdempotencyKey,
  getCostMessageById,
  getFxRates,
  insertCostMessage,
  sumSpendForApiKey,
  updateCostMessage,
  upsertProjectBySlug,
  upsertVendorByName,
  utcMonthStartIso,
  voidCostMessage,
  type Database,
} from "@costmcp/db";
import type { NextRequest } from "next/server";
import {
  allowedProjectFilter,
  clientIp,
  featureAllowed,
  ipAllowed,
  isExpired,
  parseConditions,
  policyError,
  projectAllowed,
  sourceAllowed,
  type ApiKeyPolicy,
  type KeyConditionsV1,
} from "@/lib/api-keys/conditions";
import { enforceRateLimit } from "@/lib/api-keys/rate-limit";

const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

export interface ApiKeyContext {
  workspaceId: string;
  permissions: string[];
  projectId: string | null;
  apiKeyId?: string;
  monthlyLimit?: number | null;
  policy?: ApiKeyPolicy | null;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function envApiKeyAllowed(): boolean {
  if (process.env.COSTMCP_ALLOW_ENV_API_KEY === "true") return true;
  if (process.env.COSTMCP_ALLOW_ENV_API_KEY === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export async function authenticateRequest(
  request: NextRequest,
): Promise<ApiKeyContext | Response> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token.startsWith("cmcp_")) {
    return Response.json({ error: "Invalid API key format" }, { status: 401 });
  }

  // Local/dev fallback only (disabled in production unless explicitly opted in).
  const devKey = process.env.COSTMCP_API_KEY;
  if (devKey && envApiKeyAllowed() && safeEqual(token, devKey)) {
    return {
      workspaceId: DEMO_WORKSPACE_ID,
      permissions: ["log_usage", "add_expenses", "read_summaries", "estimate_costs"],
      projectId: null,
      policy: null,
    };
  }

  try {
    const client = createServiceClient();
    const keyHash = hashKey(token);
    const { data, error } = await client
      .from("api_keys")
      .select(
        "id, workspace_id, permissions, project_id, status, key_hash, monthly_limit, expires_at, rate_limit_rpm, allowed_cidrs, conditions, environment",
      )
      .eq("key_hash", keyHash)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    if (isExpired(data.expires_at as string | null)) {
      return policyError(401, "key_expired", "API key has expired");
    }

    const allowedCidrs = (data.allowed_cidrs as string[] | null) ?? [];
    if (!ipAllowed(clientIp(request), allowedCidrs)) {
      return policyError(403, "ip_not_allowed", "Client IP is not on this key's allowlist");
    }

    const rateDenied = await enforceRateLimit(
      data.id as string,
      data.rate_limit_rpm as number | null,
    );
    if (rateDenied) return rateDenied;

    await client
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash);

    const conditions = parseConditions(data.conditions);
    const policy: ApiKeyPolicy = {
      apiKeyId: data.id as string,
      projectId: (data.project_id as string | null) ?? null,
      monthlyLimit:
        data.monthly_limit === null || data.monthly_limit === undefined
          ? null
          : Number(data.monthly_limit),
      expiresAt: (data.expires_at as string | null) ?? null,
      rateLimitRpm: (data.rate_limit_rpm as number | null) ?? null,
      allowedCidrs,
      conditions,
      environment: (data.environment as string) ?? "live",
    };

    return {
      workspaceId: data.workspace_id as string,
      permissions: (data.permissions as string[]) ?? [],
      projectId: policy.projectId,
      apiKeyId: policy.apiKeyId,
      monthlyLimit: policy.monthlyLimit,
      policy,
    };
  } catch {
    return Response.json({ error: "Auth service unavailable" }, { status: 503 });
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function requirePermission(ctx: ApiKeyContext, permission: string): Response | null {
  if (!ctx.permissions.includes(permission)) {
    return Response.json(
      {
        error: "missing_permission",
        error_description: `Missing permission: ${permission}`,
      },
      { status: 403 },
    );
  }
  return null;
}

export function assertProjectAccess(
  ctx: ApiKeyContext,
  project: { id: string; slug: string },
): Response | null {
  if (!projectAllowed(ctx.policy, project)) {
    return policyError(403, "project_not_allowed", `Key cannot access project "${project.slug}"`);
  }
  return null;
}

export async function assertMonthlyLimit(
  ctx: ApiKeyContext,
  additionalUsd = 0,
): Promise<Response | null> {
  if (!ctx.apiKeyId || ctx.monthlyLimit == null) return null;
  const client = createServiceClient();
  const spent = await sumSpendForApiKey(client, ctx.apiKeyId, utcMonthStartIso());
  if (spent + additionalUsd > ctx.monthlyLimit) {
    return policyError(
      403,
      "monthly_limit_exceeded",
      `Key monthly_limit of ${ctx.monthlyLimit.toFixed(2)} USD exceeded`,
      { limit_usd: ctx.monthlyLimit, spent_usd: spent },
    );
  }
  return null;
}

export function filterSummaryByPolicy<T extends { projects?: { slug: string } | null; project_id?: string | null }>(
  ctx: ApiKeyContext,
  rows: T[],
): T[] {
  const filter = allowedProjectFilter(ctx.policy);
  if (filter.projectId) {
    return rows.filter((r) => r.project_id === filter.projectId);
  }
  if (filter.slugs) {
    return rows.filter((r) => r.projects?.slug && filter.slugs!.includes(r.projects.slug));
  }
  const deny = ctx.policy?.conditions.deny_project_slugs;
  if (deny?.length) {
    return rows.filter((r) => !r.projects?.slug || !deny.includes(r.projects.slug));
  }
  return rows;
}

async function writeCostMessage(
  workspaceId: string,
  envelope: import("@costmcp/core").CostMessageEnvelope,
  options?: { apiKeyId?: string | null },
) {
  const client = createServiceClient();
  const { buildMessageMetadata, DEFAULT_FX_RATES, resolveAmountUsd } = await import(
    "@costmcp/core"
  );

  if (envelope.idempotency_key) {
    const existing = await findMessageByIdempotencyKey(
      client,
      workspaceId,
      envelope.idempotency_key,
    );
    if (existing) return existing;
  }

  const project = await upsertProjectBySlug(client, workspaceId, envelope.project);
  const msg = envelope.message;

  let rates = DEFAULT_FX_RATES;
  try {
    const dbRates = await getFxRates(client);
    if (Object.keys(dbRates).length) rates = { ...DEFAULT_FX_RATES, ...dbRates };
  } catch {
    // Fall back to bundled rates.
  }

  const amountUsd = resolveAmountUsd(msg, rates);
  const currency =
    "currency" in msg && msg.currency ? msg.currency.toUpperCase() : "USD";
  const amountOriginal =
    msg.type === "expense"
      ? signedMoneyAmountLocal(msg.amount, msg.expense_type)
      : "amount" in msg
        ? msg.amount
        : amountUsd;

  let vendorId: string | null = null;
  if (
    (msg.type === "expense" || msg.type === "subscription") &&
    typeof msg.vendor === "string" &&
    msg.vendor.trim()
  ) {
    const vendor = await upsertVendorByName(
      client,
      workspaceId,
      msg.vendor.trim(),
      "category" in msg ? msg.category : undefined,
    );
    vendorId = String(vendor.id);
  }

  let costCategoryId: string | null = null;
  let resolvedCategoryName: string | undefined;
  if (
    (msg.type === "expense" || msg.type === "subscription") &&
    "category" in msg &&
    typeof msg.category === "string" &&
    msg.category.trim()
  ) {
    const category = await findCategoryBySlugOrName(
      client,
      workspaceId,
      msg.category.trim(),
    );
    costCategoryId = category ? String(category.id) : null;
    resolvedCategoryName = category
      ? String(category.name)
      : msg.category.trim();
  }

  const metadata = buildMessageMetadata(msg);
  if (resolvedCategoryName) metadata.category = resolvedCategoryName;

  return insertCostMessage(client, {
    workspace_id: workspaceId,
    project_id: project.id,
    vendor_id: vendorId,
    cost_category_id: costCategoryId,
    api_key_id: options?.apiKeyId ?? null,
    message_type: msg.type,
    amount_usd: amountUsd,
    currency,
    amount_original: amountOriginal,
    unit_type: msg.type === "usage" ? msg.unit_type : undefined,
    quantity: msg.type === "usage" ? msg.quantity : undefined,
    unit_cost: msg.type === "usage" ? msg.unit_cost : undefined,
    feature: msg.type === "usage" || msg.type === "batch" ? msg.feature : undefined,
    batch_id:
      msg.type === "usage"
        ? msg.batch_id
        : msg.type === "batch"
          ? msg.name
          : undefined,
    environment: msg.type === "usage" ? msg.environment : undefined,
    source: envelope.source,
    idempotency_key: envelope.idempotency_key,
    parent_message_id:
      msg.type === "allocation" ? msg.parent_message_id : undefined,
    metadata: metadata as Database["public"]["Tables"]["cost_messages"]["Insert"]["metadata"],
    occurred_at: envelope.timestamp ?? new Date().toISOString(),
  });
}

function signedMoneyAmountLocal(amount: number, expenseType?: string) {
  if (expenseType === "refund") return -Math.abs(amount);
  return amount;
}

export async function persistCostMessage(
  ctx: ApiKeyContext,
  envelope: import("@costmcp/core").CostMessageEnvelope,
) {
  if (!sourceAllowed(ctx.policy, envelope.source)) {
    throw Object.assign(new Error(`Key cannot use source "${envelope.source}"`), {
      status: 403,
      code: "source_not_allowed",
    });
  }

  const client = createServiceClient();
  const project = await upsertProjectBySlug(client, ctx.workspaceId, envelope.project);
  if (!projectAllowed(ctx.policy, project)) {
    throw Object.assign(new Error(`Key cannot access project "${project.slug}"`), {
      status: 403,
      code: "project_not_allowed",
    });
  }

  const msg = envelope.message;
  const feature = msg.type === "usage" || msg.type === "batch" ? msg.feature : undefined;
  if (!featureAllowed(ctx.policy, feature)) {
    throw Object.assign(new Error(`Key cannot use feature "${feature ?? ""}"`), {
      status: 403,
      code: "feature_not_allowed",
    });
  }

  const { resolveAmountUsd } = await import("@costmcp/core");
  const amountUsd = resolveAmountUsd(envelope.message);
  const limitDenied = await assertMonthlyLimit(ctx, amountUsd);
  if (limitDenied) {
    const body = await limitDenied.json();
    throw Object.assign(new Error(body.error_description ?? "Monthly limit exceeded"), {
      status: 403,
      code: body.error,
      body,
    });
  }

  return writeCostMessage(ctx.workspaceId, envelope, { apiKeyId: ctx.apiKeyId ?? null });
}

/** Session-authenticated dashboard / member writes (no API key policy). */
export async function persistWorkspaceCostMessage(
  workspaceId: string,
  envelope: import("@costmcp/core").CostMessageEnvelope,
) {
  return writeCostMessage(workspaceId, envelope);
}

export async function updateWorkspaceLedgerMessage(
  workspaceId: string,
  messageId: string,
  envelope: import("@costmcp/core").CostMessageEnvelope,
) {
  const client = createServiceClient();
  const existing = await getCostMessageById(client, workspaceId, messageId);
  if (!existing || existing.voided_at) {
    throw Object.assign(new Error("Record not found"), { status: 404 });
  }
  if (existing.message_type !== envelope.message.type) {
    throw Object.assign(new Error("Cannot change message type"), { status: 400 });
  }

  const {
    buildMessageMetadata,
    DEFAULT_FX_RATES,
    resolveAmountUsd,
  } = await import("@costmcp/core");

  let rates = DEFAULT_FX_RATES;
  try {
    const dbRates = await getFxRates(client);
    if (Object.keys(dbRates).length) rates = { ...DEFAULT_FX_RATES, ...dbRates };
  } catch {
    // bundled rates
  }

  const msg = envelope.message;
  const project = await upsertProjectBySlug(client, workspaceId, envelope.project);
  const amountUsd = resolveAmountUsd(msg, rates);
  const currency =
    "currency" in msg && msg.currency ? msg.currency.toUpperCase() : "USD";
  const amountOriginal =
    msg.type === "expense"
      ? signedMoneyAmountLocal(msg.amount, msg.expense_type)
      : "amount" in msg
        ? msg.amount
        : amountUsd;

  let vendorId: string | null = existing.vendor_id as string | null;
  if (
    (msg.type === "expense" || msg.type === "subscription") &&
    typeof msg.vendor === "string" &&
    msg.vendor.trim()
  ) {
    const vendor = await upsertVendorByName(
      client,
      workspaceId,
      msg.vendor.trim(),
      "category" in msg ? msg.category : undefined,
    );
    vendorId = String(vendor.id);
  }

  let costCategoryId: string | null = existing.cost_category_id as string | null;
  let resolvedCategoryName: string | undefined;
  if (
    (msg.type === "expense" || msg.type === "subscription") &&
    "category" in msg
  ) {
    if (typeof msg.category === "string" && msg.category.trim()) {
      const category = await findCategoryBySlugOrName(
        client,
        workspaceId,
        msg.category.trim(),
      );
      costCategoryId = category ? String(category.id) : null;
      resolvedCategoryName = category
        ? String(category.name)
        : msg.category.trim();
    } else {
      costCategoryId = null;
    }
  }

  const metadata = buildMessageMetadata(msg);
  if (resolvedCategoryName) metadata.category = resolvedCategoryName;
  else if (
    (msg.type === "expense" || msg.type === "subscription") &&
    "category" in msg &&
    !msg.category
  ) {
    delete metadata.category;
  }

  const updated = await updateCostMessage(client, messageId, workspaceId, {
    project_id: project.id,
    vendor_id: vendorId,
    cost_category_id: costCategoryId,
    amount_usd: amountUsd,
    currency,
    amount_original: amountOriginal,
    metadata: metadata as Database["public"]["Tables"]["cost_messages"]["Update"]["metadata"],
    occurred_at: envelope.timestamp ?? (existing.occurred_at as string),
  });

  if (!updated) {
    throw Object.assign(new Error("Record not found"), { status: 404 });
  }
  return updated;
}

export async function voidWorkspaceLedgerMessage(
  workspaceId: string,
  messageId: string,
) {
  const client = createServiceClient();
  const existing = await getCostMessageById(client, workspaceId, messageId);
  if (!existing || existing.voided_at) {
    throw Object.assign(new Error("Record not found"), { status: 404 });
  }
  const voided = await voidCostMessage(client, messageId, workspaceId);
  if (!voided) {
    throw Object.assign(new Error("Record not found"), { status: 404 });
  }
  return voided;
}

export type { KeyConditionsV1, ApiKeyPolicy };
