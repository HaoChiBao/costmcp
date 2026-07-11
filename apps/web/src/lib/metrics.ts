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
    amount_original?: number | null;
    currency?: string;
    message_type: string;
    created_at: string;
    occurred_at?: string;
    project_slug: string | null;
    project_name: string | null;
    environment?: string | null;
    feature?: string | null;
    label: string;
    source?: string;
    vendor?: string | null;
    category?: string | null;
    notes?: string | null;
    expense_type?: string | null;
    interval?: string | null;
    status?: string | null;
    metadata?: Record<string, unknown>;
  }>;
};

export type Period = "day" | "week" | "month" | "quarter" | "year" | "all";

export type SpendFilters = {
  project?: string;
  environment?: string;
  vendor?: string;
  type?: string;
};

export type MetricsComparison = {
  period: string;
  filters: SpendFilters;
  current: {
    period_label: string;
    total_usd: number;
    message_count: number;
  };
  previous: {
    period_label: string;
    total_usd: number;
    message_count: number;
  };
  delta_usd: number;
  delta_percent: number | null;
  insight: string | null;
};

export const ENVIRONMENT_OPTIONS = [
  { value: "", label: "All environments" },
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Development" },
] as const;

export const MESSAGE_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "usage", label: "Usage" },
  { value: "expense", label: "Expense" },
  { value: "subscription", label: "Subscription" },
] as const;

export function buildSpendQuery(
  period: Period,
  filters: SpendFilters,
  extra?: Record<string, string>,
) {
  const params = new URLSearchParams({ period });
  if (filters.project) params.set("project", filters.project);
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.vendor) params.set("vendor", filters.vendor);
  if (filters.type) params.set("type", filters.type);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return params.toString();
}

export function filtersKey(filters: SpendFilters) {
  return [filters.project ?? "", filters.environment ?? "", filters.vendor ?? "", filters.type ?? ""].join(
    "|",
  );
}

export function hasActiveSpendFilters(filters: SpendFilters) {
  return Boolean(filters.project || filters.environment || filters.vendor || filters.type);
}

type ActivityItem = ActivityResponse["activity"][number];

export function filterActivityClient(
  rows: ActivityItem[],
  filters: SpendFilters,
  vendors: Array<{ slug: string; name: string }> = [],
): ActivityItem[] {
  if (!hasActiveSpendFilters(filters)) return rows;

  const vendorSlug = filters.vendor?.toLowerCase();
  const vendorName = vendorSlug
    ? vendors.find((vendor) => vendor.slug === filters.vendor)?.name.toLowerCase()
    : null;

  return rows.filter((row) => {
    if (filters.project && row.project_slug !== filters.project) return false;
    if (filters.type && row.message_type !== filters.type) return false;
    if (filters.environment && row.environment !== filters.environment) return false;
    if (vendorSlug) {
      const rowVendor = row.vendor?.toLowerCase() ?? "";
      const provider =
        typeof row.metadata?.provider === "string" ? row.metadata.provider.toLowerCase() : "";
      const matchesVendor =
        rowVendor === vendorSlug ||
        rowVendor === vendorName ||
        provider === vendorSlug;
      if (!matchesVendor) return false;
    }
    return true;
  });
}

export function resolveDisplayActivity(
  activity: ActivityResponse | null,
  filters: SpendFilters,
  vendors: Array<{ slug: string; name: string }>,
  serverActivity: ActivityResponse | null,
  isRefreshing: boolean,
): ActivityResponse | null {
  if (!activity?.activity.length) return activity;

  const hasFilters = hasActiveSpendFilters(filters);
  if (!hasFilters) return serverActivity ?? activity;

  if (serverActivity && !isRefreshing) return serverActivity;

  const filtered = filterActivityClient(activity.activity, filters, vendors);
  return {
    ...activity,
    count: filtered.length,
    activity: filtered,
  };
}

export function formatDeltaPercent(delta: number | null) {
  if (delta == null) return "—";
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct === 0) return "0%";
  return `${delta > 0 ? "+" : "-"}${pct}%`;
}

export function formatComparisonLine(comparison: MetricsComparison) {
  const period = comparison.previous.period_label.toLowerCase();
  const { delta_percent, delta_usd } = comparison;

  if (delta_usd === 0 && (delta_percent == null || delta_percent === 0)) {
    return null;
  }

  const useAbsolute =
    comparison.previous.total_usd < 1 ||
    (delta_percent != null && Math.abs(delta_percent) > 2);

  if (useAbsolute) {
    const sign = delta_usd > 0 ? "+" : delta_usd < 0 ? "−" : "";
    return `${sign}${formatUsd(Math.abs(delta_usd))} vs ${period}`;
  }

  return `${formatDeltaPercent(delta_percent)} vs ${period}`;
}

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
