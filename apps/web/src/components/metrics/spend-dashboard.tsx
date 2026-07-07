"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type ActivityResponse,
  type Period,
  type WorkspaceMetrics,
  PERIODS,
  formatUsd,
} from "@/lib/metrics";
import { AllocationBar } from "@/components/metrics/allocation-bar";
import { LedgerTable } from "@/components/metrics/ledger-table";
import { SpendChart } from "@/components/metrics/spend-chart";
import { WorkspaceStructure } from "@/components/dashboard/workspace-structure";
import { DashboardPanel, StatusBadge } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
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

function budgetBadgeLabel(budget: NonNullable<WorkspaceMetrics["budget"]>) {
  if (budget.percent_used >= 1) return "Over budget";
  if (budget.percent_used >= 0.8) return "Approaching limit";
  const remaining = Math.round((1 - budget.percent_used) * 100);
  return `${remaining}% remaining`;
}

function budgetFillClass(budget: NonNullable<WorkspaceMetrics["budget"]>) {
  if (budget.percent_used >= 1) return " budget-meter__fill--over";
  if (budget.percent_used >= 0.8) return " budget-meter__fill--warn";
  return "";
}

export function SpendDashboard({ workspaceSlug, workspaceName, org }: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in");
      setLoading(false);
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
      setMetrics(await metricsRes.json());
      if (activityRes.ok) {
        setActivity(await activityRes.json());
      } else {
        setActivity(null);
      }
    } catch {
      setError("Could not load spend. Is the API running on port 3000?");
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, period]);

  useEffect(() => {
    load();
  }, [load]);

  const ledgerRows =
    activity?.activity.map((row) => ({
      id: row.id,
      date: formatActivityDate(row.created_at),
      label: row.label,
      meta: row.project_name,
      tag: row.message_type,
      amount_usd: row.amount_usd,
    })) ?? [];

  return (
    <div className="spend-dashboard">
      <header className="dashboard-page-header">
        <div>
          <p className="meta-label">
            {org.workspace.type} · {org.role}
          </p>
          <h1 className="heading-sm">{workspaceName}</h1>
        </div>
      </header>

      {loading && (
        <DashboardPanel variant="subtle" className="loading-panel">
          <p className="caption">Loading spend…</p>
        </DashboardPanel>
      )}

      {error && (
        <DashboardPanel>
          <p className="form-error">{error}</p>
        </DashboardPanel>
      )}

      {!loading && !error && metrics && (
        <>
          <DashboardPanel variant="hero">
            <div className="dashboard-summary__top">
              <div>
                <p className="meta-label">{metrics.period_label}</p>
                <p className="dashboard-summary__amount tabular-nums" aria-live="polite">
                  {formatUsd(metrics.total_usd)}
                </p>
                <p className="dashboard-summary__meta">
                  {metrics.message_count} transaction{metrics.message_count === 1 ? "" : "s"}
                  {metrics.top_project ? ` · Top: ${metrics.top_project.name}` : ""}
                </p>
              </div>
              <div className="period-pills" role="tablist" aria-label="Time period">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={period === p.id}
                    className={`period-pill${period === p.id ? " period-pill--active" : ""}`}
                    onClick={() => setPeriod(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="stat-row">
              <StatCard
                label="Budget left"
                value={
                  metrics.budget
                    ? metrics.budget.percent_used >= 1
                      ? formatUsd(metrics.budget.spent - metrics.budget.limit)
                      : formatUsd(metrics.budget.remaining)
                    : "—"
                }
                hint={
                  metrics.budget ? `of ${formatUsd(metrics.budget.limit)} cap` : undefined
                }
              />
              <StatCard label="Transactions" value={metrics.message_count} />
              <StatCard
                label="Top project"
                value={
                  metrics.top_project ? formatUsd(metrics.top_project.amount_usd) : "—"
                }
                hint={metrics.top_project?.name}
              />
            </div>
          </DashboardPanel>

          <div className="metrics-grid">
            <DashboardPanel title="Spend over time">
              <SpendChart daily={metrics.daily} />
              <AllocationBar metrics={metrics} />
            </DashboardPanel>

            <DashboardPanel title="Budget">
              {metrics.budget ? (
                <div className="budget-panel">
                  <div className="budget-panel__row">
                    <span className="meta-label">Monthly cap</span>
                    <span className="tabular-nums">{formatUsd(metrics.budget.limit)}</span>
                  </div>
                  <div className="budget-panel__row">
                    <span className="meta-label">Spent</span>
                    <span className="tabular-nums">{formatUsd(metrics.budget.spent)}</span>
                  </div>
                  <div className="budget-meter">
                    <div className="budget-meter__track">
                      <div
                        className={`budget-meter__fill${budgetFillClass(metrics.budget)}`}
                        style={{
                          width: `${Math.min(100, Math.round(metrics.budget.percent_used * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="budget-meter__label">
                      <StatusBadge
                        warn={
                          metrics.budget.percent_used >= 0.8 &&
                          metrics.budget.percent_used < 1
                        }
                        strong={metrics.budget.percent_used >= 1}
                      >
                        {budgetBadgeLabel(metrics.budget)}
                      </StatusBadge>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="dashboard-panel__empty">No budget set for this workspace.</p>
              )}

              {metrics.by_project.length > 0 && (
                <div className="holdings-block">
                  <p className="meta-label">By project</p>
                  {metrics.by_project.slice(0, 5).map((project) => (
                    <div key={project.slug} className="holding-row">
                      <div>
                        <p className="holding-row__name">{project.name}</p>
                        <p className="holding-row__meta">
                          {Math.round(project.percent * 100)}% of spend
                        </p>
                      </div>
                      <p className="holding-row__amount tabular-nums">
                        {formatUsd(project.amount_usd)}
                      </p>
                      <div className="holding-row__bar">
                        <div
                          className="holding-row__bar-fill"
                          style={{
                            width: `${Math.max(4, Math.round(project.percent * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashboardPanel>
          </div>

          <section className="dashboard-section">
            <DashboardPanel title="Recent activity" description="Latest charges in this period">
              <LedgerTable rows={ledgerRows} />
            </DashboardPanel>
          </section>

          <WorkspaceStructure org={org} />
        </>
      )}
    </div>
  );
}
