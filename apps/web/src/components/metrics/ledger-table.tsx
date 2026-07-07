import { formatUsd } from "@/lib/metrics";

export type LedgerRow = {
  id: string;
  date: string;
  label: string;
  meta?: string | null;
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
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="data-table__date">{row.date}</td>
              <td>
                <span className="data-table__primary">{row.label}</span>
                {row.tag ? (
                  <span className="data-table__tag">{row.tag}</span>
                ) : null}
              </td>
              <td className="data-table__meta">{row.meta ?? "—"}</td>
              <td className="data-table__amount tabular-nums">
                {formatUsd(row.amount_usd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
