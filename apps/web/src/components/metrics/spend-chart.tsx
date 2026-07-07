"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WorkspaceMetrics } from "@/lib/metrics";
import { formatUsd, formatUsdCompact, normalizeWorkspaceMetrics } from "@/lib/metrics";
import {
  CHART_TYPE_SERIES,
  type ChartView,
  formatChartAxisDate,
  formatChartDate,
  projectColor,
} from "@/lib/chart-colors";

type Props = {
  metrics: WorkspaceMetrics;
};

type TooltipRow = {
  key: string;
  label: string;
  color: string;
  value: number;
};

type SpendTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: number | string }>;
  label?: string | number;
  rows: Array<{ key: string; label: string; color: string }>;
};

function SpendTooltip({
  active,
  payload,
  label,
  rows,
}: SpendTooltipProps) {
  if (!active || !payload?.length || label == null) return null;

  const valueMap = new Map(
    payload
      .filter((entry) => typeof entry.value === "number" && entry.value > 0)
      .map((entry) => [String(entry.dataKey), Number(entry.value)]),
  );

  const visibleRows: TooltipRow[] = rows
    .map((row) => ({
      ...row,
      value: valueMap.get(row.key) ?? 0,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = visibleRows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__date">{formatChartDate(String(label))}</p>
      <p className="chart-tooltip__total tabular-nums">{formatUsd(total)}</p>
      <ul className="chart-tooltip__rows">
        {visibleRows.map((row) => (
          <li key={row.key} className="chart-tooltip__row">
            <span className="chart-tooltip__swatch" style={{ background: row.color }} />
            <span className="chart-tooltip__label">{row.label}</span>
            <span className="chart-tooltip__value tabular-nums">{formatUsd(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpendChart({ metrics: rawMetrics }: Props) {
  const metrics = useMemo(() => normalizeWorkspaceMetrics(rawMetrics), [rawMetrics]);
  const [view, setView] = useState<ChartView>("type");
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const typeRows = useMemo(
    () =>
      CHART_TYPE_SERIES.map((series) => ({
        key: series.key,
        label: series.label,
        color: series.color,
        total: metrics[series.key],
      })).filter((series) => series.total > 0),
    [metrics],
  );

  const projectRows = useMemo(
    () =>
      metrics.daily_by_project.series.map((series, index) => ({
        key: series.slug,
        label: series.name,
        color: projectColor(index),
        total: metrics.daily_by_project.daily.reduce(
          (sum, day) => sum + Number(day[series.slug] ?? 0),
          0,
        ),
      })),
    [metrics],
  );

  const activeRows = view === "type" ? typeRows : projectRows;
  const chartData =
    view === "type" ? metrics.daily_by_type : metrics.daily_by_project.daily;

  const visibleRows = activeRows.filter((row) => !hiddenKeys.has(row.key));

  function toggleSeries(key: string) {
    setHiddenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!chartData.length) {
    return <p className="dashboard-panel__empty">No charges yet in this period.</p>;
  }

  return (
    <div className="chart-panel">
      <div className="chart-panel__controls">
        <div className="chart-view-toggle" role="tablist" aria-label="Chart grouping">
          <button
            type="button"
            role="tab"
            aria-selected={view === "type"}
            className={`chart-view-toggle__btn${view === "type" ? " chart-view-toggle__btn--active" : ""}`}
            onClick={() => {
              setView("type");
              setHiddenKeys(new Set());
            }}
          >
            By type
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "project"}
            className={`chart-view-toggle__btn${view === "project" ? " chart-view-toggle__btn--active" : ""}`}
            onClick={() => {
              setView("project");
              setHiddenKeys(new Set());
            }}
          >
            By project
          </button>
        </div>
      </div>

      <div className="chart-panel__canvas">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {visibleRows.map((row) => (
                <linearGradient key={row.key} id={`fill-${row.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={row.color} stopOpacity={0.34} />
                  <stop offset="100%" stopColor={row.color} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              stroke="var(--color-hairline)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartAxisDate}
              tick={{ fill: "var(--color-ash)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(value) => formatUsdCompact(Number(value))}
              tick={{ fill: "var(--color-ash)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={(props) => (
                <SpendTooltip
                  active={props.active}
                  payload={props.payload as SpendTooltipProps["payload"]}
                  label={props.label}
                  rows={activeRows}
                />
              )}
              cursor={{ stroke: "var(--color-midstone)", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            {visibleRows.map((row) => (
              <Area
                key={row.key}
                type="monotone"
                dataKey={row.key}
                stackId="spend"
                stroke={row.color}
                strokeWidth={2}
                fill={`url(#fill-${row.key})`}
                isAnimationActive
                animationDuration={480}
                activeDot={{ r: 4, strokeWidth: 2, fill: "var(--color-paper)" }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <ul className="chart-legend" aria-label="Chart series">
        {activeRows.map((row) => {
          const hidden = hiddenKeys.has(row.key);
          return (
            <li key={row.key}>
              <button
                type="button"
                className={`chart-legend__item${hidden ? " chart-legend__item--hidden" : ""}`}
                onClick={() => toggleSeries(row.key)}
                aria-pressed={!hidden}
              >
                <span className="chart-legend__swatch" style={{ background: row.color }} />
                <span className="chart-legend__label">{row.label}</span>
                <span className="chart-legend__value tabular-nums">
                  {formatUsdCompact(row.total)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
