"use client";

import { formatUsd } from "@/lib/metrics";
import { messageTypeTone } from "@/lib/org-colors";
import { Button } from "@/components/ui/button";
import { ProjectLabel } from "@/components/ui/org-pill";
import type { LedgerRow } from "@/components/metrics/ledger-table";

function vendorInitial(label: string) {
  const trimmed = label.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

export function TransactionDetail({
  row,
  editingId,
  deletingId,
  onEdit,
  onDelete,
}: {
  row: LedgerRow | null;
  editingId?: string | null;
  deletingId?: string | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  if (!row) {
    return (
      <div className="transaction-detail transaction-detail--empty">
        <p className="text-muted">Select a transaction to view details.</p>
      </div>
    );
  }

  const tone = messageTypeTone(row.tag);
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
          {vendorInitial(row.label)}
        </span>
        <div className="transaction-detail__identity">
          <h2 className="transaction-detail__title">{row.label}</h2>
          <p className="transaction-detail__datetime">{row.date}</p>
        </div>
        <p className="transaction-detail__amount tabular-nums">{formatUsd(row.amount_usd)}</p>
      </header>

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
            <Button
              type="button"
              variant="default"
              className="transaction-detail__action"
              onClick={() => onEdit(row.id)}
            >
              {editingId === row.id ? "Close" : "Edit"}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="transaction-detail__action"
              disabled={deletingId === row.id}
              onClick={() => onDelete(row.id)}
            >
              {deletingId === row.id ? "Removing…" : "Remove"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
