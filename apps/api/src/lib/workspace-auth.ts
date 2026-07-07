import { createUserClient } from "@costmcp/db";
import { authenticateUser } from "@/lib/user-auth";

export type WorkspaceAuthContext = {
  userClient: ReturnType<typeof createUserClient>;
  userId: string;
  workspaceId: string;
  workspaceSlug: string;
};

export async function authenticateWorkspaceAccess(
  request: Request,
  slug: string,
): Promise<WorkspaceAuthContext | Response> {
  const auth = await authenticateUser(request);
  if (auth instanceof Response) return auth;

  const { data: workspace, error: wsError } = await auth.client
    .from("workspaces")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (wsError) {
    return Response.json({ error: "Workspace lookup failed" }, { status: 500 });
  }
  if (!workspace) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { data: membership, error: memberError } = await auth.client
    .from("workspace_members")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (memberError) {
    return Response.json({ error: "Membership lookup failed" }, { status: 500 });
  }
  if (!membership) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    userClient: auth.client,
    userId: auth.user.id,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug as string,
  };
}

export function parsePeriod(value: string | null): "day" | "week" | "month" | "quarter" | "year" | "all" {
  const allowed = ["day", "week", "month", "quarter", "year", "all"] as const;
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as (typeof allowed)[number];
  }
  return "month";
}

export function periodStart(period: ReturnType<typeof parsePeriod>): Date | null {
  const now = new Date();
  if (period === "all") return null;

  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  switch (period) {
    case "day":
      return start;
    case "week":
      start.setUTCDate(start.getUTCDate() - 6);
      return start;
    case "month":
      start.setUTCDate(1);
      return start;
    case "quarter": {
      const q = Math.floor(start.getUTCMonth() / 3) * 3;
      start.setUTCMonth(q, 1);
      return start;
    }
    case "year":
      start.setUTCMonth(0, 1);
      return start;
    default:
      start.setUTCDate(1);
      return start;
  }
}

export function periodLabel(period: ReturnType<typeof parsePeriod>): string {
  const labels: Record<string, string> = {
    day: "Today",
    week: "Past 7 days",
    month: "This month",
    quarter: "This quarter",
    year: "This year",
    all: "All time",
  };
  return labels[period] ?? "This month";
}
