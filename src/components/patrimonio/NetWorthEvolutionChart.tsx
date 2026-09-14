"use client";

import { useState } from "react";
import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { formatMonthKeyLabel, formatMonthKeyShortLabel } from "@/lib/dates";
import { useChartWidth } from "@/lib/use-chart-width";
import type { PatrimonioMonthPoint } from "@/lib/patrimonio";

const FALLBACK_WIDTH = 480;
const HEIGHT = 220;
const PAD_LEFT = 56;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const MAX_X_LABELS = 6;
const Y_TICKS = 4;
const BAR_FRACTION = 0.5;
const MIN_BAR_WIDTH = 4;
const MAX_BAR_WIDTH = 28;
const BAR_RADIUS = 3;

const ASSETS_COLOR = "var(--success)";
const LIABILITIES_COLOR = "var(--danger)";
// Same blue used for "Saldo" elsewhere in the app — Patrimônio Líquido
// is conceptually a running balance too, and it needs its own color
// distinct from the green/red lines it's compared against.
const NET_WORTH_COLOR = "var(--chart-saldo)";

/** "Evolução Patrimonial" — a combo chart (spec section 2): Ativos and
 * Passivos as lines sharing one scale with Patrimônio Líquido as
 * vertical bars, so the bars' size/growth reads at a glance while the
 * lines show the two components driving it. `points` already covers
 * exactly the user's real history (src/lib/patrimonio.ts's
 * firstPatrimonioMonthKey through the current month) — this component
 * never fabricates a wider range on its own. */
export function NetWorthEvolutionChart({ points }: { points: PatrimonioMonthPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { containerRef, width: WIDTH } = useChartWidth(FALLBACK_WIDTH);

  if (points.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum dado patrimonial ainda.
      </div>
    );
  }

  const chartWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const allValues = points.flatMap((p) => [p.totalAssetsCents, p.totalLiabilitiesCents, p.netWorthCents]);
  const rawMax = Math.max(...allValues, 0);
  const rawMin = Math.min(...allValues, 0);
  const span = rawMax - rawMin;
  // Flat-line fallback (everything still R$0, e.g. before the user's
  // first cadastro) — padded by a nice round R$1.000 rather than a
  // near-zero amount, so the Y-axis ticks land on distinct compact
  // labels instead of all rounding to the same "R$0"/"R$1".
  const pad = span > 0 ? span * 0.1 : Math.max(Math.abs(rawMax), 100_000);
  const max = rawMax + pad;
  const min = rawMin - pad;
  const range = max - min || 1;

  const xFor = (i: number) =>
    PAD_LEFT + (points.length <= 1 ? chartWidth / 2 : (i / (points.length - 1)) * chartWidth);
  const yFor = (cents: number) => PAD_TOP + chartHeight - ((cents - min) / range) * chartHeight;

  const lineSeries: { key: "totalAssetsCents" | "totalLiabilitiesCents"; label: string; color: string }[] = [
    { key: "totalAssetsCents", label: "Ativos", color: ASSETS_COLOR },
    { key: "totalLiabilitiesCents", label: "Passivos", color: LIABILITIES_COLOR },
  ];

  const yLabels = Array.from({ length: Y_TICKS + 1 }, (_, i) => min + (range * i) / Y_TICKS);
  const xLabelStep = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
  const slotWidth = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slotWidth * BAR_FRACTION));
  const hoveredPoint = hovered === null ? null : points[hovered];
  const showZeroLine = min < 0 && max > 0;

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Evolução Patrimonial</p>
      <div ref={containerRef} className="relative mt-3">
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Evolução patrimonial mensal">
          {yLabels.map((value) => (
            <g key={value}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(value)}
                y2={yFor(value)}
                stroke="var(--surface-border)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text x={PAD_LEFT - 8} y={yFor(value) + 3} textAnchor="end" className="fill-[var(--text-faint)] text-[10px]">
                {formatCentsCompactBRL(value)}
              </text>
            </g>
          ))}

          {showZeroLine && (
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yFor(0)} y2={yFor(0)} stroke="var(--text-faint)" strokeWidth={1} />
          )}

          {points.map((p, i) => {
            const barY = Math.min(yFor(p.netWorthCents), yFor(0));
            const barHeight = Math.abs(yFor(p.netWorthCents) - yFor(0));
            const opacity = hovered === null || hovered === i ? 0.85 : 0.4;
            return (
              barHeight > 0 && (
                <rect
                  key={p.monthKey}
                  x={xFor(i) - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  rx={BAR_RADIUS}
                  fill={NET_WORTH_COLOR}
                  opacity={opacity}
                />
              )
            );
          })}

          {lineSeries.map((s) => (
            <polyline
              key={s.key}
              points={points.map((p, i) => `${xFor(i)},${yFor(p[s.key])}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
            />
          ))}
          {lineSeries.map((s) =>
            points.map((p, i) => (
              <circle key={`${s.key}-${p.monthKey}`} cx={xFor(i)} cy={yFor(p[s.key])} r={hovered === i ? 4 : 3} fill={s.color} />
            ))
          )}

          {points.map(
            (p, i) =>
              i % xLabelStep === 0 && (
                <text key={p.monthKey} x={xFor(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                  {formatMonthKeyShortLabel(p.monthKey)}
                </text>
              )
          )}

          {points.map((p, i) => (
            <rect
              key={p.monthKey}
              x={xFor(i) - slotWidth / 2}
              y={0}
              width={slotWidth}
              height={HEIGHT}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {hoveredPoint && (
          <div
            className={`pointer-events-none absolute top-1 z-10 w-52 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-[11px] shadow-lg ${
              hovered === 0 ? "" : hovered === points.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${(xFor(hovered!) / WIDTH) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-[var(--text-primary)]">{formatMonthKeyLabel(hoveredPoint.monthKey)}</p>
            <div className="space-y-0.5">
              {lineSeries.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(hoveredPoint[s.key])}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 border-t border-[var(--surface-border)] pt-1">
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{ backgroundColor: NET_WORTH_COLOR }} />
                  Patrimônio Líquido
                </span>
                <span className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(hoveredPoint.netWorthCents)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {lineSeries.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NET_WORTH_COLOR }} />
          Patrimônio Líquido
        </span>
      </div>
    </div>
  );
}
