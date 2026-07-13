"use client";

import { formatUsd } from "@/lib/metrics";

export type UpcomingItem = {
  kind: "obligation" | "subscription";
  id: string;
  label: string;
  amount_usd: number;
  currency: string;
  amount_original: number | null;
  due_date: string;
  remind_at?: string | null;
  project_slug?: string | null;
  project_name?: string | null;
  interval?: string | null;
  status?: string | null;
  overdue?: boolean;
};

function formatDue(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type Props = {
  items: UpcomingItem[];
  loading?: boolean;
  settlingId?: string | null;
  onSettle?: (item: UpcomingItem) => void;
  onEdit?: (item: UpcomingItem) => void;
};

export function UpcomingPayments({
  items,
  loading,
  settlingId,
  onSettle,
  onEdit,
}: Props) {
  return (
    <div className="upcoming-panel">
      <h3 className="activity-summary__title">Upcoming</h3>
      {loading && !items.length ? (
        <p className="dashboard-panel__empty">Loading…</p>
      ) : null}
      {!loading && !items.length ? (
        <p className="dashboard-panel__empty">No payments due soon.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="upcoming-list">
          {items.slice(0, 8).map((item) => {
            const amount =
              item.amount_original != null
                ? formatUsd(Number(item.amount_original))
                : formatUsd(item.amount_usd);
            const verb = item.kind === "subscription" ? "renews" : "due";
            return (
              <li
                key={`${item.kind}-${item.id}`}
                className={`upcoming-list__item${item.overdue ? " upcoming-list__item--overdue" : ""}`}
              >
                <div className="upcoming-list__main">
                  <span className="upcoming-list__label">{item.label}</span>
                  <span className="upcoming-list__amount tabular-nums">{amount}</span>
                </div>
                <div className="upcoming-list__meta">
                  <span>
                    {verb} {formatDue(item.due_date)}
                    {item.overdue ? " · overdue" : ""}
                    {item.project_name ? ` · ${item.project_name}` : ""}
                  </span>
                  {item.kind === "obligation" && onSettle ? (
                    <span className="upcoming-list__actions">
                      {onEdit ? (
                        <button
                          type="button"
                          className="upcoming-list__link"
                          onClick={() => onEdit(item)}
                        >
                          Edit
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="upcoming-list__link"
                        disabled={settlingId === item.id}
                        onClick={() => onSettle(item)}
                      >
                        {settlingId === item.id ? "…" : "Mark paid"}
                      </button>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
