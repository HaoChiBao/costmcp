import { createHash, timingSafeEqual } from "node:crypto";
import {
  createServiceClient,
  findMessageByIdempotencyKey,
  insertCostMessage,
  upsertProjectBySlug,
} from "@costmcp/db";
import type { NextRequest } from "next/server";

const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";

export interface ApiKeyContext {
  workspaceId: string;
  permissions: string[];
  projectId: string | null;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
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

  // Phase 0: accept COSTMCP_API_KEY env for local dev before api_keys table is wired (YAN-183)
  const devKey = process.env.COSTMCP_API_KEY;
  if (devKey && safeEqual(token, devKey)) {
    return {
      workspaceId: DEMO_WORKSPACE_ID,
      permissions: ["log_usage", "add_expenses", "read_summaries", "estimate_costs"],
      projectId: null,
    };
  }

  try {
    const client = createServiceClient();
    const keyHash = hashKey(token);
    const { data, error } = await client
      .from("api_keys")
      .select("workspace_id, permissions, project_id, status, key_hash")
      .eq("key_hash", keyHash)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    await client
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash);

    return {
      workspaceId: data.workspace_id as string,
      permissions: (data.permissions as string[]) ?? [],
      projectId: (data.project_id as string | null) ?? null,
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
    return Response.json({ error: `Missing permission: ${permission}` }, { status: 403 });
  }
  return null;
}

export async function persistCostMessage(
  ctx: ApiKeyContext,
  envelope: import("@costmcp/core").CostMessageEnvelope,
) {
  const client = createServiceClient();
  const { resolveAmountUsd } = await import("@costmcp/core");

  if (envelope.idempotency_key) {
    const existing = await findMessageByIdempotencyKey(
      client,
      ctx.workspaceId,
      envelope.idempotency_key,
    );
    if (existing) return existing;
  }

  const project = await upsertProjectBySlug(client, ctx.workspaceId, envelope.project);
  const amountUsd = resolveAmountUsd(envelope.message);
  const msg = envelope.message;

  const row = await insertCostMessage(client, {
    workspace_id: ctx.workspaceId,
    project_id: project.id,
    vendor_id: null,
    message_type: msg.type,
    amount_usd: amountUsd,
    currency: "currency" in msg && msg.currency ? msg.currency : "USD",
    amount_original: "amount" in msg ? msg.amount : amountUsd,
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
    metadata: msg.type === "usage" || msg.type === "batch" ? (msg.metadata ?? {}) : {},
  });

  return row;
}
