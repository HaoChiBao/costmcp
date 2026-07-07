import type { OrgTree } from "@/lib/api";
import type { WorkspaceMetrics } from "@/lib/metrics";
import { formatUsd } from "@/lib/metrics";
import {
  accountCategoryTone,
  projectColorBySlug,
  vendorCategoryTone,
} from "@/lib/org-colors";
import { DashboardPanel, StatusBadge } from "@/components/ui/panel";
import { OrgPill } from "@/components/ui/org-pill";

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

export function WorkspaceSidebar({
  org,
  metrics,
}: {
  org: OrgTree;
  metrics: WorkspaceMetrics;
}) {
  return (
    <aside className="dashboard-sidebar">
      <DashboardPanel title="Budget">
        {metrics.budget ? (
          <div className="budget-panel">
            <div className="budget-panel__summary tabular-nums">
              <span>{formatUsd(metrics.budget.spent)}</span>
              <span className="budget-panel__summary-sep">/</span>
              <span className="text-muted">{formatUsd(metrics.budget.limit)}</span>
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
                    metrics.budget.percent_used >= 0.8 && metrics.budget.percent_used < 1
                  }
                  strong={metrics.budget.percent_used >= 1}
                >
                  {budgetBadgeLabel(metrics.budget)}
                </StatusBadge>
              </p>
            </div>
          </div>
        ) : (
          <p className="dashboard-panel__empty">No budget set.</p>
        )}
      </DashboardPanel>

      {metrics.by_project.length > 0 && (
        <DashboardPanel title="By project">
          <ul className="compact-list">
            {metrics.by_project.slice(0, 6).map((project) => (
              <li key={project.slug} className="compact-list__item">
                <div className="compact-list__main">
                  <span className="compact-list__label">
                    <span
                      className="compact-list__dot"
                      style={{ backgroundColor: projectColorBySlug(project.slug) }}
                      aria-hidden="true"
                    />
                    {project.name}
                  </span>
                  <span className="compact-list__value tabular-nums">
                    {formatUsd(project.amount_usd)}
                  </span>
                </div>
                <div className="compact-list__bar">
                  <div
                    className="compact-list__bar-fill"
                    style={{
                      width: `${Math.max(4, Math.round(project.percent * 100))}%`,
                      backgroundColor: projectColorBySlug(project.slug),
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )}

      {org.vendors.length > 0 && (
        <DashboardPanel title="Vendors">
          <ul className="tag-list">
            {org.vendors.map((vendor) => {
              const tone = vendorCategoryTone(vendor.category ?? null, vendor.slug);
              return (
                <li key={vendor.id}>
                  <OrgPill tone={tone} className="tag-list__pill">
                    {vendor.name}
                  </OrgPill>
                </li>
              );
            })}
          </ul>
        </DashboardPanel>
      )}

      {org.categories.length > 0 && (
        <DashboardPanel title="Chart of accounts">
          <ul className="account-tree account-tree--compact">
            {org.categories.map((category) => {
              const tone = accountCategoryTone(category.slug);
              return (
                <li key={category.id} className="account-tree__group">
                  <span className="account-tree__parent">
                    <span
                      className="account-tree__dot"
                      style={{ backgroundColor: tone.color }}
                      aria-hidden="true"
                    />
                    {category.name}
                  </span>
                  {category.children.length > 0 && (
                    <ul className="account-tree__children">
                      {category.children.map((child) => {
                        const childTone = accountCategoryTone(child.slug);
                        return (
                          <li key={child.id}>
                            <span
                              className="account-tree__dot account-tree__dot--child"
                              style={{ backgroundColor: childTone.color }}
                              aria-hidden="true"
                            />
                            {child.name}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </DashboardPanel>
      )}
    </aside>
  );
}
