"use client";

import { formatUsd } from "@/lib/metrics";
import { formatActivityDisplay } from "@/lib/activity-display";
import { messageTypeTone } from "@/lib/org-colors";
import { ProjectLabel } from "@/components/ui/org-pill";
import type { ActivityRow } from "@/components/metrics/activity-feed";

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

export function TransactionDetail({
  row,
  editingId,
  deletingId,
  onEdit,
  onDelete,
}: {
  row: ActivityRow | null;
  editingId?: string | null;
  deletingId?: string | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  if (!row) {
    return (
      <div className="transaction-detail transaction-detail--empty">
        <p className="transaction-detail__empty-text">Select a transaction to view details.</p>
      </div>
    );
  }

  const tone = messageTypeTone(row.tag);
  const display = resolveDisplay(row);
  const original =
    row.currency && row.currency !== "USD" && row.amount_original != null
      ? `${row.amount_original.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${row.currency}`
      : null;

  return (
    <div className="transaction-detail">
      <header className="transaction-detail__header">
        <span
          className="transaction-detail__icon"
          style={{ backgroundColor: tone.bg, color: tone.color }}
          aria-hidden="true"
        >
          {display.initial}
        </span>
        <div className="transaction-detail__identity">
          <h2 className="transaction-detail__title">{display.title}</h2>
          <p className="transaction-detail__datetime">{row.date}</p>
        </div>
        <p className="transaction-detail__amount tabular-nums">{formatUsd(row.amount_usd)}</p>
      </header>

      {display.subtitle !== display.title ? (
        <p className="transaction-detail__description">{display.subtitle}</p>
      ) : null}

      <dl className="transaction-detail__grid">
        <div className="transaction-detail__field">
          <dt>Type</dt>
          <dd>{tone.label}</dd>
        </div>
        <div className="transaction-detail__field">
          <dt>Project</dt>
          <dd>
            {row.meta ? (
              <ProjectLabel name={row.meta} slug={row.projectSlug} />
            ) : (
              "—"
            )}
          </dd>
        </div>
        {original ? (
          <div className="transaction-detail__field">
            <dt>Original</dt>
            <dd className="tabular-nums">{original}</dd>
          </div>
        ) : null}
      </dl>

      {row.editable && (onEdit || onDelete) ? (
        <div className="transaction-detail__actions">
          {onEdit ? (
            <button
              type="button"
              className="dash-btn dash-btn--block"
              onClick={() => onEdit(row.id)}
            >
              {editingId === row.id ? "Close" : "Edit"}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="dash-btn dash-btn--block dash-btn--ghost"
              disabled={deletingId === row.id}
              onClick={() => onDelete(row.id)}
            >
              {deletingId === row.id ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
