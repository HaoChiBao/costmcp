import type { WorkspaceMetrics } from "@/lib/metrics";
import { formatUsdCompact } from "@/lib/metrics";

const SEGMENTS = [
  { key: "usage_usd" as const, label: "Usage" },
  { key: "subscription_usd" as const, label: "Subscription" },
  { key: "expense_usd" as const, label: "Expense" },
];

export function AllocationBar({ metrics }: { metrics: WorkspaceMetrics }) {
  const total = Math.max(metrics.total_usd, 0.0001);
  const parts = SEGMENTS.map((s) => ({
    ...s,
    amount: metrics[s.key],
    pct: metrics[s.key] / total,
  })).filter((p) => p.amount > 0);

  if (!parts.length) return null;

  return (
    <div className="allocation-panel">
      <div className="allocation-bar" role="img" aria-label="Spend by type">
        {parts.map((part) => (
          <div
            key={part.key}
            className="allocation-bar__segment"
            style={{ flex: part.pct }}
            title={`${part.label}: ${formatUsdCompact(part.amount)}`}
          />
        ))}
      </div>
      <ul className="allocation-legend">
        {parts.map((part) => (
          <li key={part.key} className="allocation-legend__item">
            <span className="allocation-legend__label">{part.label}</span>
            <span className="allocation-legend__value tabular-nums">
              {formatUsdCompact(part.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
