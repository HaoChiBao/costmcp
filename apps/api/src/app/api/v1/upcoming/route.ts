import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";
import { listUpcomingPaymentRecords } from "@/lib/obligations";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  const url = new URL(request.url);
  const daysRaw = url.searchParams.get("days");
  const days = daysRaw ? Number(daysRaw) : 30;
  const includeOverdue = url.searchParams.get("include_overdue") !== "0";

  try {
    const upcoming = await listUpcomingPaymentRecords(auth.workspaceId, {
      days: Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30,
      includeOverdue,
    });
    return Response.json({ upcoming, days: Number.isFinite(days) ? days : 30 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load upcoming payments";
    return Response.json({ error: message }, { status: 500 });
  }
}
