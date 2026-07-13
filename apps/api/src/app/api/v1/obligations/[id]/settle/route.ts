import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";
import { settleObligationRecord, statusFromError } from "@/lib/obligations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "manage_obligations");
  if (denied) return denied;

  const { id } = await params;
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await settleObligationRecord(auth.workspaceId, id, body);
    return Response.json(result);
  } catch (err) {
    const status = statusFromError(err);
    const message =
      err instanceof Error ? err.message : "Failed to settle obligation";
    return Response.json({ error: message }, { status });
  }
}
