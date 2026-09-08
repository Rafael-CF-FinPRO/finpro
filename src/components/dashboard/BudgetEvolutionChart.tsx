"use client";

import { useState } from "react";
import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { useChartWidth } from "@/lib/use-chart-width";
import type { BudgetHistoryMonthRow } from "@/lib/budget";

const RECEITA_COLOR = "var(--primary)";
const SALDO_POSITIVE_COLOR = "var(--success)";
const SALDO_NEGATIVE_COLOR = "var(--danger)";

const SERIES: { key: keyof BudgetHistoryMonthRow; label: string; color: string }[] = [
  { key: "receitaCents", label: "Receita", color: RECEITA_COLOR },
  { key: "custosCents", label: "Custos Obrigatórios", color: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS },
  { key: "prazeresCents", label: "Prazeres e Confortos", color: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS },
  { key: "investimentosCents", label: "Investimentos", color: CLASSIFICATION_COLORS.INVESTIMENTOS },
  { key: "saldoCents", label: "Saldo", color: SALDO_POSITIVE_COLOR },
];

/** Only used for the very first paint, before useChartWidth has
 * measured the card's real width. */
const FALLBACK_WIDTH = 480;
const HEIGHT = 140;
const PAD_LEFT = 42;
const PAD_RIGHT = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 16;
const Y_TICKS = 4;
/** Fraction of each month's slot given to the whole 5-bar group
 * together (the rest is breathing room between months). */
const GROUP_FRACTION = 0.78;
const BAR_GAP = 1.5;
const MIN_BAR_WIDTH = 2;
const MAX_BAR_WIDTH = 11;
const BAR_RADIUS = 2;
/** At most this many X labels — beyond it, only every Nth month is
 * labeled, so a 12-month (or longer custom) view doesn't crowd the axis
 * with overlapping text. */
const MAX_X_LABELS = 6;

/** A bar's rounded corners sit at its "outer" end — the top for a
 * positive value, the bottom for a negative one (Saldo can go either
 * way) — so every bar still reads as reaching away from the zero line,
 * regardless of sign. */
function roundedBarPath(x: number, y: number, width: number, height: number, radius: number, roundTop: boolean): string {
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) return `M${x},${y} h${width} v${height} h${-width} Z`;
  if (roundTop) {
    return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
  }
  return `M${x},${y} H${x + width} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x + r} Q${x},${y + height} ${x},${y + height - r} Z`;
}

/** "Evolução Financeira" — a grouped (not stacked) bar chart: each month
 * gets 5 independent bars side by side, one per série (Receita, Custos
 * Obrigatórios, Prazeres e Confortos, Investimentos, Saldo), all sharing
 * one R$ Y-scale so their heights are directly comparable at a glance —
 * unlike a stacked column, no bar's position depends on any other's
 * value. Saldo is the one série that can go negative, so the Y domain
 * always includes 0 and a dashed zero-reference line appears whenever
 * it does (a bar for a negative value extends down from that line
 * instead of up). Hovering a month shows every série's value as one
 * card. `useChartWidth` keeps the SVG's internal coordinate system
 * matched 1:1 to real screen pixels regardless of the card's width (see
 * that hook's own doc), and the axis text stays a fixed 11px — the
 * Visão Histórica's standard — instead of scaling with it. */
export function BudgetEvolutionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { containerRef, width: WIDTH } = useChartWidth(FALLBACK_WIDTH);

  if (months.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum mês no período selecionado.
      </div>
    );
  }

  const chartWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const allValues = months.flatMap((m) => SERIES.map((s) => m[s.key] as number));
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues, 1);
  const range = maxValue - minValue || 1;

  const slotWidth = chartWidth / months.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, (slotWidth * GROUP_FRACTION - (SERIES.length - 1) * BAR_GAP) / SERIES.length));
  const groupWidth = SERIES.length * barWidth + (SERIES.length - 1) * BAR_GAP;
  const xFor = (i: number) => PAD_LEFT + slotWidth * (i + 0.5);
  const barXFor = (i: number, seriesIndex: number) => xFor(i) - groupWidth / 2 + seriesIndex * (barWidth + BAR_GAP);
  const yFor = (value: number) => PAD_TOP + chartHeight - ((value - minValue) / range) * chartHeight;

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => minValue + (range * i) / Y_TICKS);
  const xLabelStep = Math.max(1, Math.ceil(months.length / MAX_X_LABELS));

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Evolução Financeira</p>
      <div ref={containerRef} className="relative mt-3">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Evolução mensal de Receita, Custos Obrigatórios, Prazeres e Confortos, Investimentos e Saldo"
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="var(--surface-border)"
                strokeWidth={1}
              />
              <text x={PAD_LEFT - 6} y={yFor(tick) + 3} textAnchor="end" className="fill-[var(--text-faint)] text-[11px]">
                {formatCentsCompactBRL(tick)}
              </text>
            </g>
          ))}
          {minValue < 0 && (
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(0)}
              y2={yFor(0)}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}

          {months.map((m, i) => {
            const opacity = hovered === null || hovered === i ? 1 : 0.45;
            return (
              <g key={m.monthKey}>
                {SERIES.map((series, s) => {
                  const value = m[series.key] as number;
                  const isNegative = value < 0;
                  const yTop = isNegative ? yFor(0) : yFor(value);
                  const yBottom = isNegative ? yFor(value) : yFor(0);
                  const height = yBottom - yTop;
                  if (height <= 0) return null;
                  const color = series.key === "saldoCents" ? (value >= 0 ? SALDO_POSITIVE_COLOR : SALDO_NEGATIVE_COLOR) : series.color;
                  return (
                    <path
                      key={series.key}
                      d={roundedBarPath(barXFor(i, s), yTop, barWidth, height, BAR_RADIUS, !isNegative)}
                      fill={color}
                      opacity={opacity}
                    />
                  );
                })}
                {i % xLabelStep === 0 && (
                  <text x={xFor(i)} y={HEIGHT - 4} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                    {m.shortLabel}
                  </text>
                )}
              </g>
            );
          })}

          {months.map((m, i) => (
            <rect
              key={m.monthKey}
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

        {hovered !== null && (
          <div
            className={`pointer-events-none absolute top-1 z-10 w-44 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-[11px] shadow-lg ${
              hovered === 0 ? "" : hovered === months.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${(xFor(hovered) / WIDTH) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-[var(--text-primary)]">{formatMonthKeyLabel(months[hovered].monthKey)}</p>
            <div className="space-y-0.5">
              {SERIES.map((series) => {
                const value = months[hovered][series.key] as number;
                const color =
                  series.key === "saldoCents" ? (value >= 0 ? SALDO_POSITIVE_COLOR : SALDO_NEGATIVE_COLOR) : series.color;
                return (
                  <div key={series.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      {series.label}
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}
