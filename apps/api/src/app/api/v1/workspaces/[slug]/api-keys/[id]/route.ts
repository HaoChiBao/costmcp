import { createHash, randomBytes } from "node:crypto";
import { recordApiKeyAudit } from "@/lib/api-keys/audit";
import { conditionsToJson } from "@/lib/api-keys/conditions";
import {
  API_KEY_SELECT,
  parseWriteBody,
  type ApiKeyWriteBody,
} from "@/lib/api-keys/parse";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";
import { oauthDb } from "@/lib/oauth/store";

async function loadKey(workspaceId: string, id: string) {
  const { data, error } = await oauthDb()
    .from("api_keys")
    .select(API_KEY_SELECT)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const existing = await loadKey(auth.workspaceId, id);
  if (!existing) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }

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

  const update: Record<string, unknown> = {};
  if (parsed.name !== undefined) update.name = parsed.name;
  if (parsed.permissions !== undefined) update.permissions = parsed.permissions;
  if (parsed.project_id !== undefined) update.project_id = parsed.project_id;
  if (parsed.monthly_limit !== undefined) update.monthly_limit = parsed.monthly_limit;
  if (parsed.expires_at !== undefined) update.expires_at = parsed.expires_at;
  if (parsed.rate_limit_rpm !== undefined) update.rate_limit_rpm = parsed.rate_limit_rpm;
  if (parsed.allowed_cidrs !== undefined) update.allowed_cidrs = parsed.allowed_cidrs;
  if (parsed.environment !== undefined) update.environment = parsed.environment;
  if (parsed.conditions !== undefined) update.conditions = conditionsToJson(parsed.conditions);

  if (!Object.keys(update).length) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await oauthDb()
    .from("api_keys")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .select(API_KEY_SELECT)
    .single();

  if (error) {
    return Response.json({ error: "Failed to update API key" }, { status: 500 });
  }

  await recordApiKeyAudit({
    workspaceId: auth.workspaceId,
    apiKeyId: id,
    actorUserId: auth.userId,
    action: "updated",
    metadata: { fields: Object.keys(update) },
  });

  return Response.json({ key: data });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await context.params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const existing = await loadKey(auth.workspaceId, id);
  if (!existing) {
    return Response.json({ error: "API key not found" }, { status: 404 });
  }

  const { error } = await oauthDb()
    .from("api_keys")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return Response.json({ error: "Failed to revoke API key" }, { status: 500 });
  }

  await recordApiKeyAudit({
    workspaceId: auth.workspaceId,
    apiKeyId: id,
    actorUserId: auth.userId,
    action: "revoked",
    metadata: { name: existing.name },
  });

  return Response.json({ ok: true });
}
