import { createHash, randomBytes } from "node:crypto";
import { DEFAULT_INGEST_PERMISSIONS } from "@costmcp/core";
import { createServiceClient, sumSpendForApiKey, utcMonthStartIso } from "@costmcp/db";
import { recordApiKeyAudit } from "@/lib/api-keys/audit";
import { conditionsToJson } from "@/lib/api-keys/conditions";
import {
  API_KEY_SELECT,
  parseWriteBody,
  type ApiKeyWriteBody,
} from "@/lib/api-keys/parse";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { oauthDb } from "@/lib/oauth/store";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function attachUsage(
  keys: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const monthStart = utcMonthStartIso();
  const client = createServiceClient();
  return Promise.all(
    keys.map(async (key) => {
      const limit =
        key.monthly_limit === null || key.monthly_limit === undefined
          ? null
          : Number(key.monthly_limit);
      let spent_usd: number | null = null;
      if (limit != null && typeof key.id === "string") {
        try {
          spent_usd = await sumSpendForApiKey(client, key.id, monthStart);
        } catch {
          spent_usd = null;
        }
      }
      return { ...key, spent_usd, monthly_limit: limit };
    }),
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const { data, error } = await oauthDb()
    .from("api_keys")
    .select(API_KEY_SELECT)
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to load API keys" }, { status: 500 });
  }

  const keys = await attachUsage((data ?? []) as Array<Record<string, unknown>>);
  return Response.json({ keys });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: ApiKeyWriteBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseWriteBody(body);
  if (parsed.error) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  if (!parsed.name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  if (parsed.project_id) {
    const { data: project } = await oauthDb()
      .from("projects")
      .select("id")
      .eq("id", parsed.project_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!project) {
      return Response.json({ error: "project_id not found in workspace" }, { status: 400 });
    }
  }

  const secret = randomBytes(24).toString("base64url");
  const fullKey = `cmcp_live_${secret}`;
  const keyPrefix = fullKey.slice(0, 16);

  const insertRow = {
    workspace_id: auth.workspaceId,
    name: parsed.name,
    key_prefix: keyPrefix,
    key_hash: hashKey(fullKey),
    permissions: parsed.permissions ?? DEFAULT_INGEST_PERMISSIONS,
    environment: parsed.environment ?? "live",
    status: "active",
    created_by: auth.userId,
    project_id: parsed.project_id ?? null,
    monthly_limit: parsed.monthly_limit ?? null,
    expires_at: parsed.expires_at ?? null,
    rate_limit_rpm: parsed.rate_limit_rpm ?? null,
    allowed_cidrs: parsed.allowed_cidrs ?? [],
    conditions: conditionsToJson(parsed.conditions ?? { version: 1 }),
  };

  const { data, error } = await oauthDb()
    .from("api_keys")
    .insert(insertRow)
    .select(API_KEY_SELECT)
    .single();

  if (error) {
    return Response.json({ error: "Failed to create API key" }, { status: 500 });
  }

  await recordApiKeyAudit({
    workspaceId: auth.workspaceId,
    apiKeyId: data.id as string,
    actorUserId: auth.userId,
    action: "created",
    metadata: { name: parsed.name, permissions: insertRow.permissions },
  });

  return Response.json({ key: { ...data, secret: fullKey, spent_usd: 0 } }, { status: 201 });
}
