import { listUpcomingPaymentRecords } from "@/lib/obligations";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

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
