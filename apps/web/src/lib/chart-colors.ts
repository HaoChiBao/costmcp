export type ChartView = "type" | "project";

export {
  CHART_TYPE_SERIES,
  projectColorBySlug as projectColor,
} from "@/lib/org-colors";

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
