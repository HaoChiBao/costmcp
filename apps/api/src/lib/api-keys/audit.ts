import { createServiceClient, type Json } from "@costmcp/db";

export type ApiKeyAuditAction = "created" | "updated" | "rotated" | "revoked";

export async function recordApiKeyAudit(input: {
  workspaceId: string;
  apiKeyId: string | null;
  actorUserId: string;
  action: ApiKeyAuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const client = createServiceClient();
    await client.from("api_key_audit_events").insert({
      workspace_id: input.workspaceId,
      api_key_id: input.apiKeyId,
      actor_user_id: input.actorUserId,
      action: input.action,
      metadata: (input.metadata ?? {}) as Json,
    });
  } catch {
    // Audit must never block key management.
  }
}
