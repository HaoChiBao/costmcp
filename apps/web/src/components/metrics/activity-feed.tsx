"use client";

import { formatUsd } from "@/lib/metrics";
import { messageTypeTone } from "@/lib/org-colors";
import type { LedgerRow } from "@/components/metrics/ledger-table";

function groupLabelForDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= startOfWeek) return "This week";

  if (date >= startOfMonth) {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function groupRows(rows: Array<LedgerRow & { occurredAt: string }>) {
  const groups: Array<{ label: string; items: typeof rows }> = [];
  let currentLabel: string | null = null;

  for (const row of rows) {
    const label = groupLabelForDate(row.occurredAt);
    if (label !== currentLabel) {
      groups.push({ label, items: [row] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].items.push(row);
    }
  }

  return groups;
}

function vendorInitial(label: string) {
  const trimmed = label.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function ActivityFeed({
  rows,
  selectedId,
  onSelect,
  empty = "No transactions this period.",
}: {
  rows: Array<LedgerRow & { occurredAt: string }>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  empty?: string;
}) {
  if (!rows.length) {
    return <p className="activity-feed__empty">{empty}</p>;
  }

  const groups = groupRows(rows);

  return (
    <div className="activity-feed">
      {groups.map((group) => (
        <section key={group.label} className="activity-feed__group">
          <h3 className="activity-feed__group-label">{group.label}</h3>
          <ul className="activity-feed__list">
            {group.items.map((row) => {
              const tone = messageTypeTone(row.tag);
              const isSelected = row.id === selectedId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`activity-row${isSelected ? " activity-row--selected" : ""}`}
                    onClick={() => onSelect?.(row.id)}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <span
                      className="activity-row__icon"
                      style={{ backgroundColor: tone.bg, color: tone.color }}
                      aria-hidden="true"
                    >
                      {vendorInitial(row.label)}
                    </span>
                    <span className="activity-row__body">
                      <span className="activity-row__label">{row.label}</span>
                      <span className="activity-row__meta">
                        {row.meta ?? tone.label}
                        {row.tag ? ` · ${tone.label}` : ""}
                      </span>
                    </span>
                    <span className="activity-row__date">{row.date}</span>
                    <span className="activity-row__amount tabular-nums">
                      {formatUsd(row.amount_usd)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
