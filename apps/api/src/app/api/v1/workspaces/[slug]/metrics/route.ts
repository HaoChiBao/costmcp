import { getWorkspaceMetrics } from "@costmcp/db";
import {
  authenticateWorkspaceAccess,
  parsePeriod,
  periodStart,
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
  const since = periodStart(period);
  const queryFilters = parseSpendQueryFilters(url);

  try {
    const metrics = await getWorkspaceMetrics(auth.userClient, auth.workspaceId, period, since, {
      ...toDbSpendFilters(queryFilters),
    });
    return Response.json(metrics);
  } catch {
    return Response.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
