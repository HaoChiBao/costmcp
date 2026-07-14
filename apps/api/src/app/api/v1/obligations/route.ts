import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";
import {
  createObligationRecord,
  listObligationRecords,
  statusFromError,
} from "@/lib/obligations";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const dueBefore = url.searchParams.get("due_before") ?? undefined;
  const dueAfter = url.searchParams.get("due_after") ?? undefined;

  try {
    const obligations = await listObligationRecords(auth.workspaceId, {
      status,
      dueBefore,
      dueAfter,
    });
    return Response.json({ obligations });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list obligations";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "manage_obligations");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const obligation = await createObligationRecord(auth.workspaceId, {
      ...(typeof body === "object" && body ? body : {}),
      source: "api",
    });
    return Response.json({ obligation }, { status: 201 });
  } catch (err) {
    const status = statusFromError(err);
    const message =
      err instanceof Error ? err.message : "Failed to create obligation";
    return Response.json({ error: message }, { status: status === 500 ? 400 : status });
  }
}
