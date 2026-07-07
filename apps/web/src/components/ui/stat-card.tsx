import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  live?: boolean;
}) {
  return (
    <div className="stat-tile">
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value tabular-nums">{value}</p>
      {hint ? <p className="stat-tile__hint">{hint}</p> : null}
    </div>
  );
}
