import { formatUsd } from "@/lib/metrics";
import { messageTypeTone } from "@/lib/org-colors";
import { Button } from "@/components/ui/button";
import { OrgPill, ProjectLabel } from "@/components/ui/org-pill";

export type LedgerRow = {
  id: string;
  date: string;
  label: string;
  meta?: string | null;
  projectSlug?: string | null;
  tag?: string | null;
  amount_usd: number;
  currency?: string | null;
  amount_original?: number | null;
  notes?: string | null;
  feature?: string | null;
  editable?: boolean;
};

export function LedgerTable({
  rows,
  empty = "No transactions this period.",
  editingId,
  onEdit,
  onDelete,
  deletingId,
}: {
  rows: LedgerRow[];
  empty?: string;
  editingId?: string | null;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}) {
  if (!rows.length) {
    return <p className="dashboard-panel__empty">{empty}</p>;
  }

  const showActions = Boolean(onEdit || onDelete);

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Project</th>
            <th scope="col" className="data-table__amount-col">
              Amount
            </th>
            {showActions ? <th scope="col" className="data-table__actions-col" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const typeTone = messageTypeTone(row.tag);
            const original =
              row.currency &&
              row.currency !== "USD" &&
              row.amount_original != null
                ? `${row.amount_original.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })} ${row.currency}`
                : null;
            return (
              <tr
                key={row.id}
                className={editingId === row.id ? "data-table__row--editing" : undefined}
              >
                <td className="data-table__date">{row.date}</td>
                <td>
                  <span className="data-table__primary">{row.label}</span>
                  {row.tag ? (
                    <OrgPill tone={typeTone} className="data-table__tag">
                      {typeTone.label}
                    </OrgPill>
                  ) : null}
                  {original ? (
                    <span className="data-table__meta"> · {original}</span>
                  ) : null}
                </td>
                <td>
                  {row.meta ? (
                    <ProjectLabel name={row.meta} slug={row.projectSlug} />
                  ) : (
                    <span className="data-table__meta">—</span>
                  )}
                </td>
                <td className="data-table__amount tabular-nums">
                  {formatUsd(row.amount_usd)}
                </td>
                {showActions ? (
                  <td className="data-table__actions">
                    {row.editable ? (
                      <div className="ledger-actions">
                        {onEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="ledger-actions__btn"
                            onClick={() => onEdit(row.id)}
                          >
                            {editingId === row.id ? "Close" : "Edit"}
                          </Button>
                        ) : null}
                        {onDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="ledger-actions__btn"
                            disabled={deletingId === row.id}
                            onClick={() => onDelete(row.id)}
                          >
                            {deletingId === row.id ? "…" : "Delete"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
