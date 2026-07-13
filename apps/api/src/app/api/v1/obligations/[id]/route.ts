import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";
import {
  cancelObligationRecord,
  deleteObligationRecord,
  statusFromError,
  updateObligationRecord,
} from "@/lib/obligations";
import { createServiceClient, getObligationById } from "@costmcp/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  const { id } = await params;
  try {
    const obligation = await getObligationById(
      createServiceClient(),
      auth.workspaceId,
      id,
    );
    if (!obligation) {
      return Response.json({ error: "Obligation not found" }, { status: 404 });
    }
    return Response.json({ obligation });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load obligation";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "manage_obligations");
  if (denied) return denied;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const obligation = await updateObligationRecord(auth.workspaceId, id, body);
    return Response.json({ obligation });
  } catch (err) {
    const status = statusFromError(err);
    const message =
      err instanceof Error ? err.message : "Failed to update obligation";
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "manage_obligations");
  if (denied) return denied;

  const { id } = await params;
  const url = new URL(request.url);
  const soft = url.searchParams.get("cancel") === "1";

  try {
    const obligation = soft
      ? await cancelObligationRecord(auth.workspaceId, id)
      : await deleteObligationRecord(auth.workspaceId, id);
    return Response.json(soft ? { cancelled: obligation } : { deleted: obligation });
  } catch (err) {
    const status = statusFromError(err);
    const message =
      err instanceof Error ? err.message : "Failed to delete obligation";
    return Response.json({ error: message }, { status });
  }
}
