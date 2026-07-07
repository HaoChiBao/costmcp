import type { WorkspaceMetrics } from "@/lib/metrics";
import { formatUsd } from "@/lib/metrics";

export function SpendChart({ daily }: { daily: WorkspaceMetrics["daily"] }) {
  if (!daily.length) {
    return <p className="dashboard-panel__empty">No charges yet in this period.</p>;
  }

  const width = 600;
  const height = 140;
  const padding = 12;
  const max = Math.max(...daily.map((d) => d.amount_usd), 0.01);
  const step = daily.length > 1 ? (width - padding * 2) / (daily.length - 1) : 0;

  const points = daily.map((d, i) => {
    const x = padding + i * step;
    const y = height - padding - (d.amount_usd / max) * (height - padding * 2);
    return `${x},${y}`;
  });

  const area = `${padding},${height - padding} ${points.join(" ")} ${padding + (daily.length - 1) * step},${height - padding}`;

  return (
    <div className="chart-panel">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Spend over time"
      >
        <polyline
          fill="var(--chart-fill)"
          stroke="none"
          points={area}
        />
        <polyline
          fill="none"
          stroke="var(--chart-stroke)"
          strokeWidth="2"
          points={points.join(" ")}
        />
      </svg>
      <div className="chart-panel__axis">
        <span>{daily[0]?.date.slice(5)}</span>
        <span className="chart-panel__peak tabular-nums">{formatUsd(max)} peak</span>
        <span>{daily[daily.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
