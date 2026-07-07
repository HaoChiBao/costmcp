export type ChartView = "type" | "project";

export const CHART_TYPE_SERIES = [
  { key: "usage_usd", label: "Usage", color: "var(--chart-usage)" },
  { key: "subscription_usd", label: "Subscription", color: "var(--chart-subscription)" },
  { key: "expense_usd", label: "Expense", color: "var(--chart-expense)" },
] as const;

export const CHART_PROJECT_COLORS = [
  "var(--chart-project-1)",
  "var(--chart-project-2)",
  "var(--chart-project-3)",
  "var(--chart-project-4)",
  "var(--chart-project-5)",
  "var(--chart-project-6)",
] as const;

export function projectColor(index: number) {
  return CHART_PROJECT_COLORS[index % CHART_PROJECT_COLORS.length];
}

export function formatChartDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function formatChartAxisDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
  }).format(parsed);
}
