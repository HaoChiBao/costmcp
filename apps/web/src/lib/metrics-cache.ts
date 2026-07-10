import type { ActivityResponse, Period, SpendFilters, WorkspaceMetrics } from "@/lib/metrics";
import { filtersKey } from "@/lib/metrics";

type CacheEntry = {
  metrics: WorkspaceMetrics;
  activity: ActivityResponse | null;
};

const store = new Map<string, CacheEntry>();

function cacheKey(workspaceSlug: string, period: Period, filters: SpendFilters = {}) {
  return `${workspaceSlug}:${period}:${filtersKey(filters)}`;
}

export function getMetricsCache(
  workspaceSlug: string,
  period: Period,
  filters: SpendFilters = {},
) {
  return store.get(cacheKey(workspaceSlug, period, filters));
}

export function setMetricsCache(
  workspaceSlug: string,
  period: Period,
  entry: CacheEntry,
  filters: SpendFilters = {},
) {
  store.set(cacheKey(workspaceSlug, period, filters), entry);
}

export function clearMetricsCache(workspaceSlug: string) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(`${workspaceSlug}:`)) store.delete(key);
  }
}

export function getLatestMetricsForWorkspace(workspaceSlug: string) {
  for (const [key, entry] of store.entries()) {
    if (key.startsWith(`${workspaceSlug}:`)) return entry;
  }
  return undefined;
}
