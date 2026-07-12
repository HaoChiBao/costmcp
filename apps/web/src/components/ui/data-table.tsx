import type { ReactNode } from "react";

export type DataTableColumn = {
  id: string;
  header: ReactNode;
  align?: "left" | "right";
  className?: string;
};

type DataTableProps = {
  columns: DataTableColumn[];
  children: ReactNode;
  empty?: ReactNode;
  isEmpty?: boolean;
  compact?: boolean;
  flush?: boolean;
  className?: string;
};

export function DataTableWrap({
  children,
  flush = false,
  className = "",
}: {
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  const classes = [
    "data-table-wrap",
    flush ? "data-table-wrap--flush" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}

export function DataTable({
  columns,
  children,
  empty = "No results.",
  isEmpty = false,
  compact = false,
  flush = false,
  className = "",
}: DataTableProps) {
  if (isEmpty) {
    return typeof empty === "string" ? (
      <p className="dashboard-panel__empty">{empty}</p>
    ) : (
      empty
    );
  }

  const tableClass = ["data-table", compact ? "data-table--compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <DataTableWrap flush={flush}>
      <table className={tableClass}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={[
                  column.align === "right" ? "data-table__amount-col" : "",
                  column.className ?? "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </DataTableWrap>
  );
}
