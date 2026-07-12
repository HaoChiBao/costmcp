import { formatUsd } from "@/lib/metrics";
import { messageTypeTone } from "@/lib/org-colors";
import { DataTable } from "@/components/ui/data-table";
import { OrgPill, ProjectLabel } from "@/components/ui/org-pill";
import { RowActions } from "@/components/ui/row-actions";

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
  const showActions = Boolean(onEdit || onDelete);

  const columns = [
    { id: "date", header: "Date" },
    { id: "description", header: "Description" },
    { id: "project", header: "Project" },
    { id: "amount", header: "Amount", align: "right" as const },
    ...(showActions
      ? [{ id: "actions", header: "", className: "data-table__actions-col" }]
      : []),
  ];

  return (
    <DataTable columns={columns} isEmpty={!rows.length} empty={empty}>
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

        const actions = [];
        if (row.editable && onEdit) {
          actions.push({
            label: editingId === row.id ? "Close" : "Edit",
            onClick: () => onEdit(row.id),
          });
        }
        if (row.editable && onDelete) {
          actions.push({
            label: deletingId === row.id ? "…" : "Delete",
            onClick: () => onDelete(row.id),
            disabled: deletingId === row.id,
            danger: true,
          });
        }

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
                {actions.length ? <RowActions actions={actions} /> : null}
              </td>
            ) : null}
          </tr>
        );
      })}
    </DataTable>
  );
}
