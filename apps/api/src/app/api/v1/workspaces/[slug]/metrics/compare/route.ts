import { getWorkspaceSpendMessages } from "@costmcp/db";
import {
  authenticateWorkspaceAccess,
  parsePeriod,
  periodEnd,
  periodLabel,
  periodStart,
  previousPeriodLabel,
  previousPeriodRange,
} from "@/lib/workspace-auth";
import { parseSpendQueryFilters, toDbSpendFilters } from "@/lib/spend-query";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const queryFilters = parseSpendQueryFilters(url);
  const dbFilters = toDbSpendFilters(queryFilters);

  const previousRange = previousPeriodRange(period);
  if (!previousRange) {
    return Response.json({ error: "Comparison is not available for all-time view" }, { status: 400 });
  }

  try {
    const since = periodStart(period);
    const until = periodEnd();
    const [currentRows, previousRows] = await Promise.all([
      getWorkspaceSpendMessages(auth.userClient, auth.workspaceId, {
        ...dbFilters,
        since,
        until,
      }),
      getWorkspaceSpendMessages(auth.userClient, auth.workspaceId, {
        ...dbFilters,
        since: previousRange.since,
        until: previousRange.until,
      }),
    ]);

    const currentTotal = currentRows.reduce((sum, row) => sum + row.amount_usd, 0);
    const previousTotal = previousRows.reduce((sum, row) => sum + row.amount_usd, 0);
    const deltaUsd = currentTotal - previousTotal;
    const deltaPercent =
      previousTotal > 0 ? deltaUsd / previousTotal : currentTotal > 0 ? 1 : null;

    const currentUsage = currentRows
      .filter((row) => row.message_type === "usage")
      .reduce((sum, row) => sum + row.amount_usd, 0);
    const previousUsage = previousRows
      .filter((row) => row.message_type === "usage")
      .reduce((sum, row) => sum + row.amount_usd, 0);
    const usageDeltaPercent =
      previousUsage > 0 ? (currentUsage - previousUsage) / previousUsage : null;

    let insight: string | null = null;
    if (deltaPercent != null && Math.abs(deltaPercent) >= 0.15) {
      const pct = Math.round(Math.abs(deltaPercent) * 100);
      const direction = deltaPercent > 0 ? "more" : "less";
      insight = `You spent ${pct}% ${direction} than ${previousPeriodLabel(period).toLowerCase()}.`;
    } else if (usageDeltaPercent != null && Math.abs(usageDeltaPercent) >= 0.5) {
      const pct = Math.round(Math.abs(usageDeltaPercent) * 100);
      const direction = usageDeltaPercent > 0 ? "more" : "less";
      insight = `Usage costs are ${pct}% ${direction} than ${previousPeriodLabel(period).toLowerCase()}.`;
    }

    return Response.json({
      period,
      filters: queryFilters,
      current: {
        period_label: periodLabel(period),
        total_usd: currentTotal,
        message_count: currentRows.length,
      },
      previous: {
        period_label: previousPeriodLabel(period),
        total_usd: previousTotal,
        message_count: previousRows.length,
      },
      delta_usd: deltaUsd,
      delta_percent: deltaPercent,
      insight,
    });
  } catch {
    return Response.json({ error: "Failed to load comparison" }, { status: 500 });
  }
}
