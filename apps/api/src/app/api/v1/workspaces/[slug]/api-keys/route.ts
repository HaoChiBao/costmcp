import { randomBytes, createHash } from "node:crypto";
import { DEFAULT_INGEST_PERMISSIONS, type ApiPermission } from "@costmcp/core";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { oauthDb } from "@/lib/oauth/store";

const VALID_PERMISSIONS = new Set<string>([
  "log_usage",
  "add_expenses",
  "read_summaries",
  "estimate_costs",
  "manage_subscriptions",
  "delete_records",
]);

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
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
    .select(
      "id, name, key_prefix, permissions, environment, status, last_used_at, created_at, project_id",
    )
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to load API keys" }, { status: 500 });
  }
  return Response.json({ keys: data ?? [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: { name?: string; permissions?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const permissions: ApiPermission[] =
    Array.isArray(body.permissions) && body.permissions.length > 0
      ? (body.permissions.filter((p) => VALID_PERMISSIONS.has(p)) as ApiPermission[])
      : DEFAULT_INGEST_PERMISSIONS;

  // cmcp_live_ prefix keeps these distinct from OAuth access tokens (cmcp_at_).
  const secret = randomBytes(24).toString("base64url");
  const fullKey = `cmcp_live_${secret}`;
  const keyPrefix = fullKey.slice(0, 16);

  const { data, error } = await oauthDb()
    .from("api_keys")
    .insert({
      workspace_id: auth.workspaceId,
      name,
      key_prefix: keyPrefix,
      key_hash: hashKey(fullKey),
      permissions,
      environment: "live",
      status: "active",
      created_by: auth.userId,
    })
    .select("id, name, key_prefix, permissions, environment, status, created_at")
    .single();

  if (error) {
    return Response.json({ error: "Failed to create API key" }, { status: 500 });
  }

  // Full key is returned exactly once; only the hash is stored.
  return Response.json({ key: { ...data, secret: fullKey } }, { status: 201 });
}
