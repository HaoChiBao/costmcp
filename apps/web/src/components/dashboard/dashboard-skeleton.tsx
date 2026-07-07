import { DashboardPanel } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";

export function DashboardSkeleton() {
  return (
    <div className="spend-dashboard spend-dashboard--skeleton" aria-busy="true" aria-live="polite">
      <DashboardPanel variant="hero" className="dashboard-hero skeleton-panel">
        <div className="skeleton-block skeleton-block--title" />
        <div className="skeleton-block skeleton-block--amount" />
        <div className="skeleton-row">
          <div className="skeleton-block skeleton-block--stat" />
          <div className="skeleton-block skeleton-block--stat" />
          <div className="skeleton-block skeleton-block--stat" />
        </div>
      </DashboardPanel>

      <div className="dashboard-layout">
        <div className="dashboard-layout__main">
          <DashboardPanel title="Spend over time" className="skeleton-panel">
            <div className="skeleton-block skeleton-block--chart" />
          </DashboardPanel>
          <DashboardPanel title="Recent activity" className="skeleton-panel">
            <div className="skeleton-stack">
              <div className="skeleton-block skeleton-block--line" />
              <div className="skeleton-block skeleton-block--line" />
              <div className="skeleton-block skeleton-block--line" />
            </div>
          </DashboardPanel>
        </div>
        <aside className="dashboard-sidebar">
          <DashboardPanel title="Budget" className="skeleton-panel">
            <div className="skeleton-block skeleton-block--line" />
          </DashboardPanel>
        </aside>
      </div>

      <p className="dashboard-loading-status">
        <Spinner size={16} />
        <span>Loading spend…</span>
      </p>
    </div>
  );
}
