import { getWorkspaceMetrics, getWorkspaceSpendMessages } from "@costmcp/db";
import {
  authenticateWorkspaceAccess,
  parsePeriod,
  periodStart,
} from "@/lib/workspace-auth";

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
  const project = url.searchParams.get("project");
  const messageType = url.searchParams.get("type");
  const environment = url.searchParams.get("environment");

  try {
    const metrics = await getWorkspaceMetrics(auth.userClient, auth.workspaceId, period, since, {
      projectSlug: project,
      messageType,
      environment,
    });
    return Response.json(metrics);
  } catch {
    return Response.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
