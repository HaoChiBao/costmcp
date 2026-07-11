"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type ActivityResponse,
  type MetricsComparison,
  type Period,
  type SpendFilters,
  type WorkspaceMetrics,
  PERIODS,
  buildSpendQuery,
  formatComparisonLine,
  formatUsd,
  hasActiveSpendFilters,
  normalizeWorkspaceMetrics,
  resolveDisplayActivity,
} from "@/lib/metrics";
import {
  clearMetricsCache,
  getLatestMetricsForWorkspace,
  getMetricsCache,
  setMetricsCache,
} from "@/lib/metrics-cache";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AddExpenseForm } from "@/components/metrics/add-expense-form";
import { AddSubscriptionForm } from "@/components/metrics/add-subscription-form";
import { ActivityFeed } from "@/components/metrics/activity-feed";
import { SpendFiltersBar } from "@/components/metrics/spend-filters-bar";
import { SpendChart } from "@/components/metrics/spend-chart";
import { TransactionDetail } from "@/components/metrics/transaction-detail";
import { formatActivityDisplay, formatActivityRowDate } from "@/lib/activity-display";
import type { OrgTree } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Props = {
  workspaceSlug: string;
  workspaceName: string;
  org: OrgTree;
};

type Composer = "expense" | "subscription" | null;

function resolveCategorySlug(org: OrgTree, value: string | null | undefined) {
  if (!value) return "";
  for (const parent of org.categories) {
    if (parent.slug === value || parent.name === value) return parent.slug;
    for (const child of parent.children) {
      if (child.slug === value || child.name === value) return child.slug;
    }
  }
  return value;
}

function formatActivityDate(iso: string) {
  return formatActivityRowDate(iso);
}

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function readCachedMetrics(workspaceSlug: string, period: Period, filters: SpendFilters) {
  const cached =
    getMetricsCache(workspaceSlug, period, filters) ??
    (period === "month" && !hasActiveSpendFilters(filters)
      ? getLatestMetricsForWorkspace(workspaceSlug)
      : undefined);

  if (!cached) return undefined;

  return {
    metrics: normalizeWorkspaceMetrics(cached.metrics),
    activity: cached.activity,
  };
}

function ActivitySummary({ metrics }: { metrics: WorkspaceMetrics }) {
  return (
    <div className="activity-summary">
      <h3 className="activity-summary__title">Period summary</h3>
      <p className="activity-summary__amount tabular-nums">{formatUsd(metrics.total_usd)}</p>
      <p className="activity-summary__period">{metrics.period_label}</p>
      <dl className="activity-summary__stats">
        <div className="activity-summary__stat">
          <dt>Transactions</dt>
          <dd className="tabular-nums">{metrics.message_count}</dd>
        </div>
        <div className="activity-summary__stat">
          <dt>Budget left</dt>
          <dd className="tabular-nums">
            {metrics.budget
              ? metrics.budget.percent_used >= 1
                ? formatUsd(metrics.budget.spent - metrics.budget.limit)
                : formatUsd(metrics.budget.remaining)
              : "—"}
          </dd>
        </div>
        <div className="activity-summary__stat">
          <dt>Top project</dt>
          <dd>{metrics.top_project?.name ?? "—"}</dd>
        </div>
      </dl>
      {metrics.budget ? (
        <div style={{ marginTop: "var(--spacing-16)" }}>
          <div className="budget-meter">
            <div className="budget-meter__track">
              <div
                className={`budget-meter__fill${
                  metrics.budget.percent_used >= 1
                    ? " budget-meter__fill--over"
                    : metrics.budget.percent_used >= 0.8
                      ? " budget-meter__fill--warn"
                      : ""
                }`}
                style={{
                  width: `${Math.min(100, Math.round(metrics.budget.percent_used * 100))}%`,
                }}
              />
            </div>
          </div>
          <p className="activity-summary__budget-meta">
            {formatUsd(metrics.budget.spent)} of {formatUsd(metrics.budget.limit)} used
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function SpendDashboard({ workspaceSlug, workspaceName, org: initialOrg }: Props) {
  const [org, setOrg] = useState(initialOrg);
  const [period, setPeriod] = useState<Period>("month");
  const [filters, setFilters] = useState<SpendFilters>({});
  const [comparison, setComparison] = useState<MetricsComparison | null>(null);
  const [exporting, setExporting] = useState(false);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(
    () => readCachedMetrics(workspaceSlug, "month", {})?.metrics ?? null,
  );
  const [activity, setActivity] = useState<ActivityResponse | null>(
    () => readCachedMetrics(workspaceSlug, "month", {})?.activity ?? null,
  );
  const [initialLoad, setInitialLoad] = useState(
    () => !readCachedMetrics(workspaceSlug, "month", {}),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [, startTransition] = useTransition();

  function applyPeriod(next: Period) {
    if (next === period) return;
    const cached = readCachedMetrics(workspaceSlug, next, filters);
    startTransition(() => {
      if (cached) {
        setMetrics(cached.metrics);
        setActivity(cached.activity);
        setInitialLoad(false);
      }
      setPeriod(next);
    });
  }

  function applyFilters(next: SpendFilters) {
    const cached = readCachedMetrics(workspaceSlug, period, next);
    startTransition(() => {
      if (cached) {
        setMetrics(cached.metrics);
        setActivity(cached.activity);
        setInitialLoad(false);
      }
      setFilters(next);
    });
  }

  const refreshOrg = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceSlug}/org`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      setOrg((await res.json()) as OrgTree);
    } catch {
      // Keep existing org tree on failure.
    }
  }, [workspaceSlug]);

  const reloadDashboard = useCallback(() => {
    clearMetricsCache(workspaceSlug);
    setComposer(null);
    setEditingId(null);
    setReloadToken((token) => token + 1);
    void refreshOrg();
  }, [workspaceSlug, refreshOrg]);

  useEffect(() => {
    setOrg(initialOrg);
  }, [initialOrg]);

  useEffect(() => {
    let cancelled = false;
    const cached =
      reloadToken === 0 ? readCachedMetrics(workspaceSlug, period, filters) : undefined;

    if (cached) {
      setMetrics(cached.metrics);
      setActivity(cached.activity);
      setInitialLoad(false);
    } else if (reloadToken === 0) {
      const fallback =
        !hasActiveSpendFilters(filters) ? getLatestMetricsForWorkspace(workspaceSlug) : undefined;
      if (fallback) {
        setMetrics(normalizeWorkspaceMetrics(fallback.metrics));
        setActivity(fallback.activity);
        setInitialLoad(false);
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
      const query = buildSpendQuery(period, filters);

      try {
        const metricsPromise = fetch(`${base}/metrics?${query}`, { headers });
        const activityPromise = fetch(`${base}/activity?${query}&limit=50`, { headers });
        const comparePromise =
          period === "all"
            ? Promise.resolve(null)
            : fetch(`${base}/metrics/compare?${query}`, { headers });

        const [metricsRes, activityRes, compareRes] = await Promise.all([
          metricsPromise,
          activityPromise,
          comparePromise,
        ]);
        if (!metricsRes.ok) throw new Error("Failed to load metrics");

        const nextMetrics = normalizeWorkspaceMetrics(
          (await metricsRes.json()) as WorkspaceMetrics,
        );
        const nextActivity = activityRes.ok
          ? ((await activityRes.json()) as ActivityResponse)
          : null;
        const nextComparison =
          compareRes?.ok ? ((await compareRes.json()) as MetricsComparison) : null;

        if (cancelled) return;

        setMetricsCache(
          workspaceSlug,
          period,
          {
            metrics: nextMetrics,
            activity: nextActivity,
          },
          filters,
        );
        setMetrics(nextMetrics);
        setActivity(nextActivity);
        setComparison(nextComparison);
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
  }, [workspaceSlug, period, filters, reloadToken]);

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
        (item) => item !== period && !getMetricsCache(workspaceSlug, item, filters),
      );

      await Promise.all(
        targets.map(async (targetPeriod) => {
          try {
            const query = buildSpendQuery(targetPeriod, filters);
            const [metricsRes, activityRes] = await Promise.all([
              fetch(`${base}/metrics?${query}`, { headers }),
              fetch(`${base}/activity?${query}&limit=50`, { headers }),
            ]);
            if (!metricsRes.ok || cancelled) return;

            setMetricsCache(
              workspaceSlug,
              targetPeriod,
              {
                metrics: normalizeWorkspaceMetrics((await metricsRes.json()) as WorkspaceMetrics),
                activity: activityRes.ok
                  ? ((await activityRes.json()) as ActivityResponse)
                  : null,
              },
              filters,
            );
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
  }, [workspaceSlug, period, filters, initialLoad, refreshing, reloadToken]);

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in");
        return;
      }
      const query = buildSpendQuery(period, filters, { format: "csv" });
      const res = await fetch(
        `${API_URL}/api/v1/workspaces/${workspaceSlug}/activity?${query}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `costmcp-${workspaceSlug}-${period}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export CSV.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteRow(id: string) {
    if (!window.confirm("Remove this entry from the ledger?")) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${API_URL}/api/v1/workspaces/${workspaceSlug}/expenses/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not delete entry.");
        return;
      }
      if (selectedId === id) setSelectedId(null);
      reloadDashboard();
    } catch {
      setError("Could not delete entry.");
    } finally {
      setDeletingId(null);
    }
  }

  const sourceActivity = useMemo(() => {
    if (hasActiveSpendFilters(filters)) {
      return getMetricsCache(workspaceSlug, period, {})?.activity ?? activity;
    }
    return activity;
  }, [workspaceSlug, period, filters, activity]);

  const displayActivity = useMemo(
    () =>
      resolveDisplayActivity(sourceActivity, filters, org.vendors, activity, refreshing),
    [sourceActivity, filters, org.vendors, activity, refreshing],
  );

  const hasExactFilterCache = Boolean(getMetricsCache(workspaceSlug, period, filters));
  const backgroundRefresh = refreshing && metrics !== null;
  const metricsPending = backgroundRefresh && hasActiveSpendFilters(filters) && !hasExactFilterCache;

  const editingRow = displayActivity?.activity.find((row) => row.id === editingId) ?? null;

  const ledgerRows =
    displayActivity?.activity.map((row) => {
      const display = formatActivityDisplay({
        label: row.label,
        messageType: row.message_type,
        projectName: row.project_name,
        vendor: row.vendor,
        feature: row.feature,
      });

      return {
        id: row.id,
        date: formatActivityDate(row.occurred_at ?? row.created_at),
        occurredAt: row.occurred_at ?? row.created_at,
        label: row.label,
        displayTitle: display.title,
        displayMeta: display.subtitle,
        displayInitial: display.initial,
        meta: row.project_name,
        projectSlug: row.project_slug,
        tag: row.message_type,
        amount_usd: row.amount_usd,
        currency: row.currency,
        amount_original: row.amount_original,
        notes: row.notes,
        feature: row.feature,
        editable:
          row.message_type === "expense" || row.message_type === "subscription",
      };
    }) ?? [];

  const selectedRow = ledgerRows.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    if (!ledgerRows.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !ledgerRows.some((row) => row.id === selectedId)) {
      setSelectedId(ledgerRows[0].id);
    }
  }, [ledgerRows, selectedId]);

  if (initialLoad && !metrics) {
    return <DashboardSkeleton />;
  }

  if (error && !metrics) {
    return (
      <div className="activity-page">
        <div style={{ padding: "var(--spacing-32)" }}>
          <p className="form-error">{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const comparisonLine =
    comparison && period !== "all" ? formatComparisonLine(comparison) : null;

  return (
    <div
      className={`activity-page${backgroundRefresh ? " spend-dashboard--background-refresh" : ""}`}
      aria-busy={refreshing}
    >
      {backgroundRefresh ? (
        <div className="dashboard-progress" aria-hidden="true">
          <div className="dashboard-progress__bar" />
        </div>
      ) : null}

      <header className="activity-page__header">
        <div className="activity-page__header-row">
          <h1 className="activity-page__title">Activity</h1>

          <div className="activity-page__controls">
            <div className="period-pills" role="tablist" aria-label="Time period">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={period === p.id}
                  className={`period-pill${period === p.id ? " period-pill--active" : ""}`}
                  onClick={() => applyPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="activity-page__actions">
              <button
                type="button"
                className="dash-btn dash-btn--ghost"
                disabled={exporting}
                onClick={() => void exportCsv()}
              >
                {exporting ? "Exporting…" : "Export"}
              </button>
              <button
                type="button"
                className={`dash-btn${composer === "expense" ? " dash-btn--active" : ""}`}
                onClick={() => {
                  setEditingId(null);
                  setComposer((c) => (c === "expense" ? null : "expense"));
                }}
              >
                {composer === "expense" ? "Close" : "Add expense"}
              </button>
              <button
                type="button"
                className={`dash-btn dash-btn--primary${composer === "subscription" ? " dash-btn--active" : ""}`}
                onClick={() => {
                  setEditingId(null);
                  setComposer((c) => (c === "subscription" ? null : "subscription"));
                }}
              >
                {composer === "subscription" ? "Close" : "Add subscription"}
              </button>
            </div>
          </div>
        </div>

        <div className="activity-page__metrics">
          <p
            className={`activity-page__amount tabular-nums${metricsPending ? " activity-page__amount--pending" : ""}`}
          >
            {formatUsd(metrics.total_usd)}
          </p>
          <div className="activity-page__metrics-meta">
            <span>{metrics.period_label}</span>
            <span className="activity-page__metrics-sep" aria-hidden="true">
              ·
            </span>
            <span>{workspaceName}</span>
            {comparisonLine ? (
              <>
                <span className="activity-page__metrics-sep" aria-hidden="true">
                  ·
                </span>
                <span
                  className={`activity-page__delta tabular-nums${
                    comparison && comparison.delta_usd > 0
                      ? " activity-page__delta--up"
                      : comparison && comparison.delta_usd < 0
                        ? " activity-page__delta--down"
                        : ""
                  }`}
                >
                  {comparisonLine}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <SpendFiltersBar
          org={org}
          filters={filters}
          onChange={applyFilters}
        />
      </header>

      <details className="activity-page__chart">
        <summary>Spend over time</summary>
        <div className="activity-page__chart-body">
          <SpendChart metrics={metrics} />
        </div>
      </details>

      <div className="activity-page__split">
        <div className="activity-page__list">
          {error ? <p className="form-error">{error}</p> : null}

          {composer === "expense" ? (
            <div className="activity-page__composer">
              <AddExpenseForm
                workspaceSlug={workspaceSlug}
                org={org}
                onSuccess={reloadDashboard}
                onCancel={() => setComposer(null)}
              />
            </div>
          ) : null}

          {composer === "subscription" ? (
            <div className="activity-page__composer">
              <AddSubscriptionForm
                workspaceSlug={workspaceSlug}
                org={org}
                onSuccess={reloadDashboard}
                onCancel={() => setComposer(null)}
              />
            </div>
          ) : null}

          {editingRow?.message_type === "expense" ? (
            <div className="activity-page__composer">
              <AddExpenseForm
                workspaceSlug={workspaceSlug}
                org={org}
                mode="edit"
                expenseId={editingRow.id}
                initial={{
                  project: editingRow.project_slug ?? "",
                  vendor: editingRow.vendor ?? "",
                  amount: String(
                    Math.abs(editingRow.amount_original ?? editingRow.amount_usd),
                  ),
                  currency: editingRow.currency ?? "USD",
                  category: resolveCategorySlug(org, editingRow.category),
                  expenseType: editingRow.expense_type ?? "one_time_purchase",
                  notes: editingRow.notes ?? "",
                  occurredAt: toDatetimeLocalValue(
                    editingRow.occurred_at ?? editingRow.created_at,
                  ),
                }}
                onSuccess={reloadDashboard}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : null}

          {editingRow?.message_type === "subscription" ? (
            <div className="activity-page__composer">
              <AddSubscriptionForm
                workspaceSlug={workspaceSlug}
                org={org}
                mode="edit"
                subscriptionId={editingRow.id}
                initial={{
                  project: editingRow.project_slug ?? "",
                  vendor: editingRow.vendor ?? "",
                  amount: String(
                    Math.abs(editingRow.amount_original ?? editingRow.amount_usd),
                  ),
                  currency: editingRow.currency ?? "USD",
                  category: resolveCategorySlug(org, editingRow.category),
                  interval: editingRow.interval ?? "monthly",
                  status: editingRow.status ?? "active",
                  notes: editingRow.notes ?? "",
                  occurredAt: toDatetimeLocalValue(
                    editingRow.occurred_at ?? editingRow.created_at,
                  ),
                  renewalDate: editingRow.metadata?.renewal_date
                    ? toDateValue(String(editingRow.metadata.renewal_date))
                    : "",
                }}
                onSuccess={reloadDashboard}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : null}

          <ActivityFeed
            rows={ledgerRows}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <aside className="activity-page__detail">
          <TransactionDetail
            row={selectedRow}
            editingId={editingId}
            deletingId={deletingId}
            onEdit={(id) => {
              setComposer(null);
              setEditingId((current) => (current === id ? null : id));
            }}
            onDelete={(id) => void deleteRow(id)}
          />
          {!selectedRow ? <ActivitySummary metrics={metrics} /> : null}
        </aside>
      </div>
    </div>
  );
}
