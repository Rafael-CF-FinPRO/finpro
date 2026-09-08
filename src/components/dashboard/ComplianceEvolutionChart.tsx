"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistoryMonthRow } from "@/lib/budget";

const WIDTH = 480;
const HEIGHT = 140;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;
const Y_LABELS = [0, 50, 80, 100];
/** At most this many X labels — same decluttering rule as the other
 * historical charts (section 3: eixos sem excesso de marcações). */
const MAX_X_LABELS = 6;

function tierColorFor(pct: number): string {
  if (pct >= 80) return "var(--success)";
  if (pct >= 50) return "var(--warning)";
  return "var(--danger)";
}

/** "Cumprimento do Orçamento" evolution — one point per month, using the
 * exact same index as the monthly view's speedometer
 * (computeOverallCompliancePct in src/lib/budget-calc.ts): Custos
 * Obrigatórios/Prazeres e Confortos score by their ceiling, Investimentos
 * by its meta, never penalized for exceeding it. Points are colored by
 * the same Crítico/Atenção/Bom tiers as the gauge; the Y axis is labeled
 * exactly at 0/50/80/100 — the tier boundaries themselves — rather than
 * generic evenly-spaced ticks, since those specific numbers are what the
 * color changes at. Kept deliberately compact (a single indicator per
 * month) so the grid row it shares with Investimentos favors the
 * Top 10 Categorias panel below — see the layout in
 * src/app/(app)/dashboard/page.tsx. */
export function ComplianceEvolutionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
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

  const xFor = (i: number) =>
    PAD_LEFT + (months.length <= 1 ? chartWidth / 2 : (i / (months.length - 1)) * chartWidth);
  const yFor = (pct: number) => PAD_TOP + chartHeight - (Math.min(Math.max(pct, 0), 100) / 100) * chartHeight;

  const points = months.map((m, i) => `${xFor(i)},${yFor(m.compliancePct)}`).join(" ");
  const xLabelStep = Math.max(1, Math.ceil(months.length / MAX_X_LABELS));
  const slotWidth = months.length > 1 ? chartWidth / (months.length - 1) : chartWidth;

  const hoveredMonth = hovered === null ? null : months[hovered];

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Cumprimento do Orçamento</p>
      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Evolução mensal do Cumprimento do Orçamento"
        >
          {Y_LABELS.map((ref) => (
            <g key={ref}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(ref)}
                y2={yFor(ref)}
                stroke="var(--surface-border)"
                strokeWidth={1}
                strokeDasharray={ref === 0 || ref === 100 ? undefined : "4 3"}
              />
              <text x={PAD_LEFT - 6} y={yFor(ref) + 3} textAnchor="end" className="fill-[var(--text-faint)] text-[11px]">
                {ref}%
              </text>
            </g>
          ))}

          <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth={2} opacity={0.4} />
          {months.map((m, i) => (
            <circle
              key={m.monthKey}
              cx={xFor(i)}
              cy={yFor(m.compliancePct)}
              r={hovered === i ? 5 : 4}
              fill={tierColorFor(m.compliancePct)}
            />
          ))}

          {months.map(
            (m, i) =>
              i % xLabelStep === 0 && (
                <text
                  key={m.monthKey}
                  x={xFor(i)}
                  y={HEIGHT - 5}
                  textAnchor="middle"
                  className="fill-[var(--muted)] text-[11px]"
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

        {hoveredMonth && (
          <div
            className={`pointer-events-none absolute top-1 z-10 w-48 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-[11px] shadow-lg ${
              hovered === 0 ? "" : hovered === months.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${(xFor(hovered!) / WIDTH) * 100}%` }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="font-semibold text-[var(--text-primary)]">{formatMonthKeyLabel(hoveredMonth.monthKey)}</p>
              <span className="font-semibold" style={{ color: tierColorFor(hoveredMonth.compliancePct) }}>
                {hoveredMonth.compliancePct}%
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS }}
                  />
                  Custos Obrigatórios
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {formatCentsToBRL(hoveredMonth.custosCents)} / {formatCentsToBRL(hoveredMonth.custosBudgetedCents)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS }}
                  />
                  Prazeres e Confortos
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {formatCentsToBRL(hoveredMonth.prazeresCents)} / {formatCentsToBRL(hoveredMonth.prazeresBudgetedCents)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CLASSIFICATION_COLORS.INVESTIMENTOS }}
                  />
                  Investimentos
                </span>
                <span className="font-medium text-[var(--text-primary)]">
                  {formatCentsToBRL(hoveredMonth.investimentosCents)} /{" "}
                  {formatCentsToBRL(hoveredMonth.investimentosMetaCents)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--danger)" }} />
          Crítico (&lt;50%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--warning)" }} />
          Atenção (50-79%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--success)" }} />
          Bom (≥80%)
        </span>
      </div>
    </div>
  );
}
