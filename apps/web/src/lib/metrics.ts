export type WorkspaceMetrics = {
  period: string;
  period_label: string;
  total_usd: number;
  usage_usd: number;
  expense_usd: number;
  subscription_usd: number;
  message_count: number;
  daily: Array<{ date: string; amount_usd: number }>;
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
