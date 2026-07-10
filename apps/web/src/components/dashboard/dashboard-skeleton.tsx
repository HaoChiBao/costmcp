import { Spinner } from "@/components/ui/spinner";

export function DashboardSkeleton() {
  return (
    <div className="activity-page spend-dashboard--skeleton" aria-busy="true" aria-live="polite">
      <header className="activity-page__header">
        <div className="activity-page__header-row">
          <div className="skeleton-block skeleton-block--title" style={{ width: "5.5rem", height: "1.25rem" }} />
          <div className="skeleton-row" style={{ width: "18rem", gap: "6px" }}>
            <div className="skeleton-block skeleton-block--stat" style={{ height: "2rem" }} />
            <div className="skeleton-block skeleton-block--stat" style={{ height: "2rem" }} />
          </div>
        </div>
        <div>
          <div className="skeleton-block skeleton-block--amount" style={{ width: "8rem", height: "2rem" }} />
          <div className="skeleton-block skeleton-block--line" style={{ width: "12rem", marginTop: "var(--spacing-8)" }} />
        </div>
      </header>

      <div className="activity-page__split">
        <div className="activity-page__list">
          <div className="skeleton-stack">
            <div className="skeleton-block skeleton-block--line" />
            <div className="skeleton-block skeleton-block--line" />
            <div className="skeleton-block skeleton-block--line" />
            <div className="skeleton-block skeleton-block--line" />
          </div>
        </div>
        <aside className="activity-page__detail">
          <div className="skeleton-block skeleton-block--amount" style={{ width: "70%", height: "1.75rem" }} />
          <div className="skeleton-stack" style={{ marginTop: "var(--spacing-24)" }}>
            <div className="skeleton-block skeleton-block--line" />
            <div className="skeleton-block skeleton-block--line" />
          </div>
        </aside>
      </div>

      <p className="dashboard-loading-status" style={{ padding: "var(--spacing-16)" }}>
        <Spinner size={16} />
        <span>Loading spend…</span>
      </p>
    </div>
  );
}
