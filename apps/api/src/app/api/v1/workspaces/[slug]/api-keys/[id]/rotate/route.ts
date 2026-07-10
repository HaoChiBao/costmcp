import { createHash, randomBytes } from "node:crypto";
import { recordApiKeyAudit } from "@/lib/api-keys/audit";
import { API_KEY_SELECT } from "@/lib/api-keys/parse";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { oauthDb } from "@/lib/oauth/store";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const { data: existing, error: loadError } = await oauthDb()
    .from("api_keys")
    .select(API_KEY_SELECT)
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();

  if (loadError) {
    return Response.json({ error: "Failed to load API key" }, { status: 500 });
  }
  if (!existing) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }
  if (existing.status !== "active") {
    return Response.json({ error: "Cannot rotate a revoked key" }, { status: 400 });
  }

  const secret = randomBytes(24).toString("base64url");
  const fullKey = `cmcp_live_${secret}`;
  const keyPrefix = fullKey.slice(0, 16);

  const { data, error } = await oauthDb()
    .from("api_keys")
    .update({
      key_hash: hashKey(fullKey),
      key_prefix: keyPrefix,
    })
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .select(API_KEY_SELECT)
    .single();

  if (error) {
    return Response.json({ error: "Failed to rotate API key" }, { status: 500 });
  }

  await recordApiKeyAudit({
    workspaceId: auth.workspaceId,
    apiKeyId: id,
    actorUserId: auth.userId,
    action: "rotated",
    metadata: { key_prefix: keyPrefix },
  });

  return Response.json({ key: { ...data, secret: fullKey } });
}
