"use client";

import { formatUsd } from "@/lib/metrics";
import { formatActivityDisplay } from "@/lib/activity-display";
import { messageTypeTone } from "@/lib/org-colors";
import { OrgPill } from "@/components/ui/org-pill";
import type { LedgerRow } from "@/components/metrics/ledger-table";

export type ActivityRow = LedgerRow & {
  occurredAt: string;
  displayTitle?: string;
  displayMeta?: string;
  displayInitial?: string;
};

function groupLabelForDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  if (date >= startOfWeek) return "This week";

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function groupRows(rows: ActivityRow[]) {
  const groups: Array<{ label: string; items: ActivityRow[] }> = [];
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

function resolveDisplay(row: ActivityRow) {
  if (row.displayTitle && row.displayMeta) {
    return {
      title: row.displayTitle,
      subtitle: row.displayMeta,
      initial: row.displayInitial ?? row.displayTitle.charAt(0).toUpperCase(),
    };
  }

  return formatActivityDisplay({
    label: row.label,
    messageType: row.tag,
    projectName: row.meta,
  });
}

export function ActivityFeed({
  rows,
  selectedId,
  onSelect,
  empty = "No transactions this period.",
}: {
  rows: ActivityRow[];
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
              const display = resolveDisplay(row);
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
                      {display.initial}
                    </span>
                    <span className="activity-row__label">{display.title}</span>
                    <span className="activity-row__meta">{display.subtitle}</span>
                    <span className="activity-row__type">
                      <OrgPill tone={tone} className="activity-row__type-pill">
                        {tone.label}
                      </OrgPill>
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
