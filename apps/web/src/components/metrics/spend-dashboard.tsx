"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type ActivityResponse,
  type Period,
  type WorkspaceMetrics,
  PERIODS,
  formatUsd,
  normalizeWorkspaceMetrics,
} from "@/lib/metrics";
import {
  getLatestMetricsForWorkspace,
  getMetricsCache,
  setMetricsCache,
} from "@/lib/metrics-cache";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { LedgerTable } from "@/components/metrics/ledger-table";
import { SpendChart } from "@/components/metrics/spend-chart";
import { WorkspaceSidebar } from "@/components/dashboard/workspace-sidebar";
import { WorkspaceStructure } from "@/components/dashboard/workspace-structure";
import { DashboardPanel } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import type { OrgTree } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Props = {
  workspaceSlug: string;
  workspaceName: string;
  org: OrgTree;
};

function formatActivityDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function readCachedMetrics(workspaceSlug: string, period: Period) {
  const cached =
    getMetricsCache(workspaceSlug, period) ??
    (period === "month" ? getLatestMetricsForWorkspace(workspaceSlug) : undefined);

  if (!cached) return undefined;

  return {
    metrics: normalizeWorkspaceMetrics(cached.metrics),
    activity: cached.activity,
  };
}

export function SpendDashboard({ workspaceSlug, workspaceName, org }: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(
    () => readCachedMetrics(workspaceSlug, "month")?.metrics ?? null,
  );
  const [activity, setActivity] = useState<ActivityResponse | null>(
    () => readCachedMetrics(workspaceSlug, "month")?.activity ?? null,
  );
  const [initialLoad, setInitialLoad] = useState(() => !readCachedMetrics(workspaceSlug, "month"));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPeriod(next: Period) {
    if (next === period) return;
    const cached = readCachedMetrics(workspaceSlug, next);
    if (cached) {
      setMetrics(cached.metrics);
      setActivity(cached.activity);
      setInitialLoad(false);
    }
    setPeriod(next);
  }

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedMetrics(workspaceSlug, period);

    if (cached) {
      setMetrics(cached.metrics);
      setActivity(cached.activity);
      setInitialLoad(false);
    } else {
      const fallback = getLatestMetricsForWorkspace(workspaceSlug);
      if (fallback) {
        setMetrics(normalizeWorkspaceMetrics(fallback.metrics));
        setActivity(fallback.activity);
        setInitialLoad(false);
      } else {
        setMetrics(null);
        setActivity(null);
        setInitialLoad(true);
      }
    }

    async function load() {
      setRefreshing(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setError("Not signed in");
          setRefreshing(false);
          setInitialLoad(false);
        }
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const base = `${API_URL}/api/v1/workspaces/${workspaceSlug}`;

      try {
        const [metricsRes, activityRes] = await Promise.all([
          fetch(`${base}/metrics?period=${period}`, { headers }),
          fetch(`${base}/activity?period=${period}&limit=20`, { headers }),
        ]);
        if (!metricsRes.ok) throw new Error("Failed to load metrics");

        const nextMetrics = normalizeWorkspaceMetrics(
          (await metricsRes.json()) as WorkspaceMetrics,
        );
        const nextActivity = activityRes.ok
          ? ((await activityRes.json()) as ActivityResponse)
          : null;

        if (cancelled) return;

        setMetricsCache(workspaceSlug, period, {
          metrics: nextMetrics,
          activity: nextActivity,
        });
        setMetrics(nextMetrics);
        setActivity(nextActivity);
      } catch {
        if (!cancelled && !cached) {
          setError("Could not load spend. Is the API running on port 3000?");
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          setInitialLoad(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, period]);

  useEffect(() => {
    if (initialLoad || refreshing) return;

    let cancelled = false;

    async function prefetchPeriods() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const base = `${API_URL}/api/v1/workspaces/${workspaceSlug}`;
      const targets = PERIODS.map((item) => item.id).filter(
        (item) => item !== period && !getMetricsCache(workspaceSlug, item),
      );

      await Promise.all(
        targets.map(async (targetPeriod) => {
          try {
            const [metricsRes, activityRes] = await Promise.all([
              fetch(`${base}/metrics?period=${targetPeriod}`, { headers }),
              fetch(`${base}/activity?period=${targetPeriod}&limit=20`, { headers }),
            ]);
            if (!metricsRes.ok || cancelled) return;

            setMetricsCache(workspaceSlug, targetPeriod, {
              metrics: normalizeWorkspaceMetrics((await metricsRes.json()) as WorkspaceMetrics),
              activity: activityRes.ok
                ? ((await activityRes.json()) as ActivityResponse)
                : null,
            });
          } catch {
            // Best-effort prefetch only.
          }
        }),
      );
    }

    const timer = window.setTimeout(() => {
      void prefetchPeriods();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workspaceSlug, period, initialLoad, refreshing]);

  const ledgerRows =
    activity?.activity.map((row) => ({
      id: row.id,
      date: formatActivityDate(row.created_at),
      label: row.label,
      meta: row.project_name,
      projectSlug: row.project_slug,
      tag: row.message_type,
      amount_usd: row.amount_usd,
    })) ?? [];

  if (initialLoad && !metrics) {
    return <DashboardSkeleton />;
  }

  if (error && !metrics) {
    return (
      <div className="spend-dashboard">
        <DashboardPanel>
          <p className="form-error">{error}</p>
        </DashboardPanel>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div
      className={`spend-dashboard${refreshing ? " spend-dashboard--refreshing" : ""}`}
      aria-busy={refreshing}
    >
      {refreshing ? (
        <div className="dashboard-progress" aria-hidden="true">
          <div className="dashboard-progress__bar" />
        </div>
      ) : null}

      <DashboardPanel variant="hero" className="dashboard-hero">
        <div className="dashboard-hero__bar">
          <div className="dashboard-hero__identity">
            <h1 className="dashboard-hero__title">{workspaceName}</h1>
            <p className="dashboard-hero__meta">
              {org.workspace.type} · {org.role}
            </p>
          </div>
          <div className="period-pills" role="tablist" aria-label="Time period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                className={`period-pill${period === p.id ? " period-pill--active" : ""}${refreshing && period === p.id ? " period-pill--loading" : ""}`}
                onClick={() => applyPeriod(p.id)}
                disabled={refreshing && period === p.id}
              >
                {refreshing && period === p.id ? <Spinner size={14} /> : p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-hero__body">
          <div className="dashboard-hero__primary">
            <p className="meta-label">{metrics.period_label}</p>
            <p className="dashboard-hero__amount tabular-nums" aria-live="polite">
              {formatUsd(metrics.total_usd)}
            </p>
          </div>
          <dl className="dashboard-hero__stats">
            <div className="dashboard-hero__stat">
              <dt>Transactions</dt>
              <dd className="tabular-nums">{metrics.message_count}</dd>
            </div>
            <div className="dashboard-hero__stat">
              <dt>Budget left</dt>
              <dd className="tabular-nums">
                {metrics.budget
                  ? metrics.budget.percent_used >= 1
                    ? formatUsd(metrics.budget.spent - metrics.budget.limit)
                    : formatUsd(metrics.budget.remaining)
                  : "—"}
              </dd>
            </div>
            <div className="dashboard-hero__stat">
              <dt>Top project</dt>
              <dd>{metrics.top_project?.name ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </DashboardPanel>

      <div className="dashboard-layout">
        <div className="dashboard-layout__main">
          <DashboardPanel title="Spend over time" className="dashboard-panel--live">
            <SpendChart metrics={metrics} />
          </DashboardPanel>

          <DashboardPanel title="Recent activity" className="dashboard-panel--live">
            <LedgerTable rows={ledgerRows} />
          </DashboardPanel>

          <WorkspaceStructure org={org} />
        </div>

        <WorkspaceSidebar org={org} metrics={metrics} />
      </div>
    </div>
  );
}
