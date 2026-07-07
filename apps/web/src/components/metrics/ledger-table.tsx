import { formatUsd } from "@/lib/metrics";
import { messageTypeTone } from "@/lib/org-colors";
import { OrgPill, ProjectLabel } from "@/components/ui/org-pill";

export type LedgerRow = {
  id: string;
  date: string;
  label: string;
  meta?: string | null;
  projectSlug?: string | null;
  tag?: string | null;
  amount_usd: number;
};

export function LedgerTable({
  rows,
  empty = "No transactions this period.",
}: {
  rows: LedgerRow[];
  empty?: string;
}) {
  if (!rows.length) {
    return <p className="dashboard-panel__empty">{empty}</p>;
  }

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
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const typeTone = messageTypeTone(row.tag);
            return (
              <tr key={row.id}>
                <td className="data-table__date">{row.date}</td>
                <td>
                  <span className="data-table__primary">{row.label}</span>
                  {row.tag ? (
                    <OrgPill tone={typeTone} className="data-table__tag">
                      {typeTone.label}
                    </OrgPill>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
