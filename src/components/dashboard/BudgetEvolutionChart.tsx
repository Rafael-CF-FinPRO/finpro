"use client";

import { useState } from "react";
import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistoryMonthRow } from "@/lib/budget";

const RECEITA_COLOR = "var(--primary)";
const SALDO_POSITIVE_COLOR = "var(--chart-saldo)";
const SALDO_NEGATIVE_COLOR = "var(--danger)";

/** Bottom-to-top stacking order for the column — same priority order
 * used everywhere else in the app (Visão Geral, Orçamento × Realizado):
 * Custos Obrigatórios, Prazeres e Confortos, Investimentos, then
 * whatever's left over as Saldo. Because saldoCents is defined as
 * receita − custos − prazeres − investimentos (src/lib/budget.ts), the
 * four segments always sum back to exactly receitaCents — so the
 * column's own top edge is Receita, with no separate segment needed for
 * it (it shows in the legend/tooltip only). */
const SEGMENT_KEYS = ["custosCents", "prazeresCents", "investimentosCents", "saldoCents"] as const;

const LEGEND: { key: keyof BudgetHistoryMonthRow; label: string; color: string }[] = [
  { key: "receitaCents", label: "Receita", color: RECEITA_COLOR },
  { key: "custosCents", label: "Custos Obrigatórios", color: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS },
  { key: "prazeresCents", label: "Prazeres e Confortos", color: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS },
  { key: "investimentosCents", label: "Investimentos", color: CLASSIFICATION_COLORS.INVESTIMENTOS },
  { key: "saldoCents", label: "Saldo", color: SALDO_POSITIVE_COLOR },
];

const WIDTH = 480;
const HEIGHT = 200;
const PAD_LEFT = 46;
const PAD_RIGHT = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;
const Y_TICKS = 4;
const BAR_FRACTION = 0.62;
const MIN_BAR_WIDTH = 4;
const MAX_BAR_WIDTH = 34;
const BAR_RADIUS = 3;
/** At most this many X labels — beyond it, only every Nth month is
 * labeled, so a 12-month (or longer custom) view doesn't crowd the axis
 * with overlapping text. */
const MAX_X_LABELS = 6;

/** Path for a bar segment with rounded top corners and a square bottom
 * — applied only to the Saldo segment, which (see SEGMENT_KEYS above)
 * always sits at the column's true visual peak whether it's a surplus
 * stacked on top or a deficit notched back down from an overspend
 * peak. */
function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) return `M${x},${y} h${width} v${height} h${-width} Z`;
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/** "Evolução Financeira" — one stacked column per month showing how
 * that month's Receita split into Custos Obrigatórios, Prazeres e
 * Confortos, Investimentos and Saldo. Segments stack as a *signed*
 * running total (not four independent bars) — in a surplus month Saldo
 * adds on top of Investimentos and the stack's peak lands exactly on
 * Receita; in a deficit month Custos+Prazeres+Investimentos alone
 * already exceeds Receita, so Saldo is negative and gets drawn as a
 * red notch descending from that overspend peak back down to the
 * Receita line — the red area *is* the size of the deficit. This only
 * works because saldoCents is defined as the remainder
 * (receita − custos − prazeres − investimentos), so the four segments
 * always sum back to receitaCents exactly, in both directions.
 * Investimentos keeps its own segment (never folded into Custos/
 * Prazeres) since it's a destination for money, not consumption — same
 * framing as ValueDistributionDonut and SpendingDistributionChart.
 * Hovering a column shows every value for that month as one card. Sized
 * for a 2-up grid (viewBox scales down responsively) — see Visão
 * Histórica's layout in src/app/(app)/dashboard/page.tsx. */
export function BudgetEvolutionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (months.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum mês no período selecionado.
      </div>
    );
  }

  const chartWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  // The column's peak is Receita on a surplus month but the (taller)
  // Custos+Prazeres+Investimentos total on a deficit month — the Y
  // domain has to cover whichever is tallest across the period.
  const maxValue = Math.max(
    ...months.flatMap((m) => [m.receitaCents, m.custosCents + m.prazeresCents + m.investimentosCents]),
    1
  );

  const slotWidth = chartWidth / months.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slotWidth * BAR_FRACTION));
  const xFor = (i: number) => PAD_LEFT + slotWidth * (i + 0.5);
  const yFor = (value: number) => PAD_TOP + chartHeight - (value / maxValue) * chartHeight;

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (maxValue * i) / Y_TICKS);
  const xLabelStep = Math.max(1, Math.ceil(months.length / MAX_X_LABELS));

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Evolução Financeira</p>
      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
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
              <text x={PAD_LEFT - 6} y={yFor(tick) + 3} textAnchor="end" className="fill-[var(--text-faint)] text-[8px]">
                {formatCentsCompactBRL(tick)}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const x = xFor(i) - barWidth / 2;
            const opacity = hovered === null || hovered === i ? 1 : 0.45;
            const cumulative = [0];
            for (const key of SEGMENT_KEYS) cumulative.push(cumulative[cumulative.length - 1] + m[key]);

            return (
              <g key={m.monthKey}>
                {SEGMENT_KEYS.map((key, segIndex) => {
                  const from = cumulative[segIndex];
                  const to = cumulative[segIndex + 1];
                  const yFrom = yFor(from);
                  const yTo = yFor(to);
                  const y = Math.min(yFrom, yTo);
                  const height = Math.abs(yFrom - yTo);
                  if (height <= 0) return null;

                  const isSaldo = key === "saldoCents";
                  const color = isSaldo ? (m.saldoCents >= 0 ? SALDO_POSITIVE_COLOR : SALDO_NEGATIVE_COLOR) : LEGEND[segIndex + 1].color;

                  return isSaldo ? (
                    <path
                      key={key}
                      d={roundedTopBarPath(x, y, barWidth, height, BAR_RADIUS)}
                      fill={color}
                      opacity={opacity}
                    />
                  ) : (
                    <rect key={key} x={x} y={y} width={barWidth} height={height} fill={color} opacity={opacity} />
                  );
                })}
                {i % xLabelStep === 0 && (
                  <text x={xFor(i)} y={HEIGHT - 5} textAnchor="middle" className="fill-[var(--muted)] text-[8px]">
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
              {LEGEND.map((item) => {
                const value = months[hovered][item.key] as number;
                const color =
                  item.key === "saldoCents" ? (value >= 0 ? SALDO_POSITIVE_COLOR : SALDO_NEGATIVE_COLOR) : item.color;
                return (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      {item.label}
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
        {LEGEND.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
