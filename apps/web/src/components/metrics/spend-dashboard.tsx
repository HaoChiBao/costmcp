"use client";

import { useCallback, useEffect, useState } from "react";
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
  clearMetricsCache,
  getLatestMetricsForWorkspace,
  getMetricsCache,
  setMetricsCache,
} from "@/lib/metrics-cache";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AddExpenseForm } from "@/components/metrics/add-expense-form";
import { AddSubscriptionForm } from "@/components/metrics/add-subscription-form";
import { LedgerTable } from "@/components/metrics/ledger-table";
import { SpendChart } from "@/components/metrics/spend-chart";
import { WorkspaceSidebar } from "@/components/dashboard/workspace-sidebar";
import { WorkspaceStructure } from "@/components/dashboard/workspace-structure";
import { Button } from "@/components/ui/button";
import { DashboardPanel } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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

export function SpendDashboard({ workspaceSlug, workspaceName, org: initialOrg }: Props) {
  const [org, setOrg] = useState(initialOrg);
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
  const [composer, setComposer] = useState<Composer>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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
    const cached = reloadToken === 0 ? readCachedMetrics(workspaceSlug, period) : undefined;

    if (cached) {
      setMetrics(cached.metrics);
      setActivity(cached.activity);
      setInitialLoad(false);
    } else if (reloadToken === 0) {
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
  }, [workspaceSlug, period, reloadToken]);

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
  }, [workspaceSlug, period, initialLoad, refreshing, reloadToken]);

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
      reloadDashboard();
    } catch {
      setError("Could not delete entry.");
    } finally {
      setDeletingId(null);
    }
  }

  const editingRow = activity?.activity.find((row) => row.id === editingId) ?? null;

  const ledgerRows =
    activity?.activity.map((row) => ({
      id: row.id,
      date: formatActivityDate(row.occurred_at ?? row.created_at),
      label: row.label,
      meta: row.project_name,
      projectSlug: row.project_slug,
      tag: row.message_type,
      amount_usd: row.amount_usd,
      currency: row.currency,
      amount_original: row.amount_original,
      editable:
        row.message_type === "expense" || row.message_type === "subscription",
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

          <DashboardPanel className="dashboard-panel--live">
            <header className="activity-header">
              <h2 className="dashboard-panel__title">Recent activity</h2>
              <div className="activity-header__actions">
                <Button
                  type="button"
                  variant={composer === "expense" ? "ghost" : "ink"}
                  onClick={() => {
                    setEditingId(null);
                    setComposer((c) => (c === "expense" ? null : "expense"));
                  }}
                >
                  {composer === "expense" ? "Close" : "+ Expense"}
                </Button>
                <Button
                  type="button"
                  variant={composer === "subscription" ? "ghost" : "default"}
                  onClick={() => {
                    setEditingId(null);
                    setComposer((c) => (c === "subscription" ? null : "subscription"));
                  }}
                >
                  {composer === "subscription" ? "Close" : "+ Subscription"}
                </Button>
              </div>
            </header>

            {error ? <p className="form-error">{error}</p> : null}

            {composer === "expense" ? (
              <AddExpenseForm
                workspaceSlug={workspaceSlug}
                org={org}
                onSuccess={reloadDashboard}
                onCancel={() => setComposer(null)}
              />
            ) : null}

            {composer === "subscription" ? (
              <AddSubscriptionForm
                workspaceSlug={workspaceSlug}
                org={org}
                onSuccess={reloadDashboard}
                onCancel={() => setComposer(null)}
              />
            ) : null}

            {editingRow?.message_type === "expense" ? (
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
            ) : null}

            {editingRow?.message_type === "subscription" ? (
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
            ) : null}

            <LedgerTable
              rows={ledgerRows}
              editingId={editingId}
              deletingId={deletingId}
              onEdit={(id) => {
                setComposer(null);
                setEditingId((current) => (current === id ? null : id));
              }}
              onDelete={(id) => void deleteRow(id)}
            />
          </DashboardPanel>

          <WorkspaceStructure org={org} />
        </div>

        <WorkspaceSidebar org={org} metrics={metrics} />
      </div>
    </div>
  );
}
