export type WorkspaceMetrics = {
  period: string;
  period_label: string;
  total_usd: number;
  usage_usd: number;
  expense_usd: number;
  subscription_usd: number;
  message_count: number;
  daily: Array<{ date: string; amount_usd: number }>;
  daily_by_type: Array<{
    date: string;
    usage_usd: number;
    subscription_usd: number;
    expense_usd: number;
    total_usd: number;
  }>;
  daily_by_project: {
    series: Array<{ slug: string; name: string }>;
    daily: Array<{ date: string } & Record<string, number | string>>;
  };
  by_project: Array<{ slug: string; name: string; amount_usd: number; percent: number }>;
  by_type: Record<string, number>;
  budget: {
    name: string;
    limit: number;
    spent: number;
    remaining: number;
    percent_used: number;
    status: "ok" | "warning" | "danger";
  } | null;
  top_project: { slug: string; name: string; amount_usd: number } | null;
};

type RawWorkspaceMetrics = Omit<WorkspaceMetrics, "daily_by_type" | "daily_by_project"> & {
  daily_by_type?: WorkspaceMetrics["daily_by_type"];
  daily_by_project?: WorkspaceMetrics["daily_by_project"];
};

export function normalizeWorkspaceMetrics(metrics: RawWorkspaceMetrics): WorkspaceMetrics {
  const daily_by_type =
    metrics.daily_by_type ??
    metrics.daily.map((point) => ({
      date: point.date,
      usage_usd: point.amount_usd,
      subscription_usd: 0,
      expense_usd: 0,
      total_usd: point.amount_usd,
    }));

  const daily_by_project =
    metrics.daily_by_project ?? buildDailyByProjectFallback(metrics);

  return {
    ...metrics,
    daily_by_type,
    daily_by_project,
  };
}

function buildDailyByProjectFallback(
  metrics: RawWorkspaceMetrics,
): WorkspaceMetrics["daily_by_project"] {
  const topProjects = metrics.by_project.slice(0, 5).map((project) => ({
    slug: project.slug,
    name: project.name,
  }));

  if (!topProjects.length) {
    return {
      series: [{ slug: "total", name: "Total" }],
      daily: metrics.daily.map((point) => ({
        date: point.date,
        total: point.amount_usd,
      })),
    };
  }

  const series = [...topProjects, { slug: "other", name: "Other" }];
  const primarySlug = topProjects[0]?.slug ?? "other";

  return {
    series,
    daily: metrics.daily.map((point) => {
      const row: { date: string } & Record<string, number | string> = { date: point.date };
      for (const project of series) {
        row[project.slug] = project.slug === primarySlug ? point.amount_usd : 0;
      }
      return row;
    }),
  };
}

export type ActivityResponse = {
  period: string;
  count: number;
  activity: Array<{
    id: string;
    amount_usd: number;
    message_type: string;
    created_at: string;
    project_slug: string | null;
    project_name: string | null;
    label: string;
  }>;
};

export type Period = "day" | "week" | "month" | "quarter" | "year" | "all";

export const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "day", label: "1D" },
  { id: "week", label: "1W" },
  { id: "month", label: "1M" },
  { id: "quarter", label: "3M" },
  { id: "year", label: "YTD" },
  { id: "all", label: "All" },
];

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount);
}

export function formatUsdCompact(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return formatUsd(amount);
}
