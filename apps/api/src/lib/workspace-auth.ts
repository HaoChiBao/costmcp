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

export function previousPeriodLabel(period: ReturnType<typeof parsePeriod>): string {
  const labels: Record<string, string> = {
    day: "Yesterday",
    week: "Prior 7 days",
    month: "Last month",
    quarter: "Last quarter",
    year: "Prior year (YTD)",
    all: "Previous period",
  };
  return labels[period] ?? "Previous period";
}

export function periodEnd(): Date {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

export function previousPeriodRange(
  period: ReturnType<typeof parsePeriod>,
): { since: Date; until: Date } | null {
  if (period === "all") return null;

  const now = periodEnd();

  switch (period) {
    case "day": {
      const until = new Date(now);
      until.setUTCDate(until.getUTCDate() - 1);
      const since = new Date(until);
      since.setUTCHours(0, 0, 0, 0);
      return { since, until };
    }
    case "week": {
      const currentStart = periodStart("week");
      if (!currentStart) return null;
      const until = new Date(currentStart);
      until.setUTCMilliseconds(until.getUTCMilliseconds() - 1);
      const since = new Date(until);
      since.setUTCDate(since.getUTCDate() - 6);
      since.setUTCHours(0, 0, 0, 0);
      return { since, until };
    }
    case "month": {
      const currentStart = periodStart("month");
      if (!currentStart) return null;
      const until = new Date(currentStart);
      until.setUTCMilliseconds(until.getUTCMilliseconds() - 1);
      const since = new Date(until);
      since.setUTCDate(1);
      since.setUTCHours(0, 0, 0, 0);
      return { since, until };
    }
    case "quarter": {
      const currentStart = periodStart("quarter");
      if (!currentStart) return null;
      const until = new Date(currentStart);
      until.setUTCMilliseconds(until.getUTCMilliseconds() - 1);
      const since = new Date(currentStart);
      since.setUTCMonth(since.getUTCMonth() - 3);
      since.setUTCHours(0, 0, 0, 0);
      return { since, until };
    }
    case "year": {
      const currentStart = periodStart("year");
      if (!currentStart) return null;
      const since = new Date(currentStart);
      since.setUTCFullYear(since.getUTCFullYear() - 1);
      const until = new Date(now);
      until.setUTCFullYear(until.getUTCFullYear() - 1);
      return { since, until };
    }
    default:
      return null;
  }
}
