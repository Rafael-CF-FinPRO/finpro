"use client";

import { useState } from "react";
import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistoryMonthRow } from "@/lib/budget";

const SALDO_COLOR = "#2a78d6";

const SERIES: { key: keyof BudgetHistoryMonthRow; label: string; color: string }[] = [
  { key: "receitaCents", label: "Receita", color: "var(--primary)" },
  { key: "custosCents", label: "Custos Obrigatórios", color: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS },
  { key: "prazeresCents", label: "Prazeres e Confortos", color: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS },
  { key: "investimentosCents", label: "Investimentos", color: CLASSIFICATION_COLORS.INVESTIMENTOS },
  { key: "saldoCents", label: "Saldo", color: SALDO_COLOR },
];

const WIDTH = 480;
const HEIGHT = 200;
const PAD_LEFT = 46;
const PAD_RIGHT = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;
const Y_TICKS = 3;
/** At most this many X labels — beyond it, only every Nth month is
 * labeled, so a 12-month view doesn't crowd the axis with overlapping
 * text (section 3: eixos discretos, sem excesso de marcações). */
const MAX_X_LABELS = 6;

/** "Evolução Financeira" — Receita, Custos Obrigatórios, Prazeres e
 * Confortos, Investimentos and Saldo, one line each, over the selected
 * period. A light Y axis (a few gridlines, compact R$ labels) and
 * sparse month labels on X keep values and trend readable without
 * clutter; a dashed zero-reference line only appears when Saldo
 * actually dips negative somewhere in the range. Hovering any month
 * shows every series' value for that month at once, as one small card
 * — not an isolated per-point value. The legend below names every line
 * since color alone shouldn't carry 5-way identity. Sized for a 2-up
 * grid (viewBox scales down responsively) — see Visão Histórica's
 * layout in src/app/(app)/dashboard/page.tsx. */
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

  const allValues = months.flatMap((m) => SERIES.map((s) => m[s.key] as number));
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;

  const xFor = (i: number) =>
    PAD_LEFT + (months.length <= 1 ? chartWidth / 2 : (i / (months.length - 1)) * chartWidth);
  const yFor = (value: number) => PAD_TOP + chartHeight - ((value - minValue) / range) * chartHeight;

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => minValue + (range * i) / Y_TICKS);
  const xLabelStep = Math.max(1, Math.ceil(months.length / MAX_X_LABELS));
  const slotWidth = months.length > 1 ? chartWidth / (months.length - 1) : chartWidth;

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-stone-700">Evolução Financeira</p>
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
              <text x={PAD_LEFT - 6} y={yFor(tick) + 3} textAnchor="end" className="fill-stone-400 text-[8px]">
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

          {SERIES.map((series) => {
            const points = months.map((m, i) => `${xFor(i)},${yFor(m[series.key] as number)}`).join(" ");
            return (
              <g key={series.key}>
                <polyline points={points} fill="none" stroke={series.color} strokeWidth={2} />
                {months.map((m, i) => (
                  <circle
                    key={m.monthKey}
                    cx={xFor(i)}
                    cy={yFor(m[series.key] as number)}
                    r={hovered === i ? 3.5 : 2.5}
                    fill={series.color}
                  />
                ))}
              </g>
            );
          })}

          {months.map(
            (m, i) =>
              i % xLabelStep === 0 && (
                <text
                  key={m.monthKey}
                  x={xFor(i)}
                  y={HEIGHT - 5}
                  textAnchor="middle"
                  className="fill-stone-500 text-[8px]"
                >
                  {m.shortLabel}
                </text>
              )
          )}

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
            <p className="mb-1 font-semibold text-stone-900">{formatMonthKeyLabel(months[hovered].monthKey)}</p>
            <div className="space-y-0.5">
              {SERIES.map((series) => (
                <div key={series.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-stone-600">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: series.color }} />
                    {series.label}
                  </span>
                  <span className="font-medium text-stone-900">
                    {formatCentsToBRL(months[hovered][series.key] as number)}
                  </span>
                </div>
              ))}
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
