import type { ActivityResponse, Period, WorkspaceMetrics } from "@/lib/metrics";

type CacheEntry = {
  metrics: WorkspaceMetrics;
  activity: ActivityResponse | null;
};

const store = new Map<string, CacheEntry>();

function cacheKey(workspaceSlug: string, period: Period) {
  return `${workspaceSlug}:${period}`;
}

export function getMetricsCache(workspaceSlug: string, period: Period) {
  return store.get(cacheKey(workspaceSlug, period));
}

export function setMetricsCache(
  workspaceSlug: string,
  period: Period,
  entry: CacheEntry,
) {
  store.set(cacheKey(workspaceSlug, period), entry);
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
