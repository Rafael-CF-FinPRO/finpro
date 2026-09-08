"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { useChartWidth } from "@/lib/use-chart-width";
import type { BudgetHistoryMonthRow } from "@/lib/budget";

const RECEITA_COLOR = "var(--primary)";
const SALDO_POSITIVE_COLOR = "var(--success)";
const SALDO_NEGATIVE_COLOR = "var(--danger)";

/** Top-to-bottom funnel order — Receita is always the mouth (100% of
 * itself), each classification narrows it further, Saldo is whatever's
 * left. Same order/semantics as the single-month "Visão Geral" funnel
 * (src/components/dashboard/IncomeFlowFunnel.tsx) this chart recovers
 * the visual language of, just repeated once per month instead of
 * showing only the selected month. */
const STAGE_DEFS = [
  { key: "receitaCents", label: "Receita", color: RECEITA_COLOR },
  { key: "custosCents", label: "Custos Obrigatórios", color: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS },
  { key: "prazeresCents", label: "Prazeres e Confortos", color: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS },
  { key: "investimentosCents", label: "Investimentos", color: CLASSIFICATION_COLORS.INVESTIMENTOS },
  { key: "saldoCents", label: "Saldo", color: SALDO_POSITIVE_COLOR },
] as const satisfies { key: keyof BudgetHistoryMonthRow; label: string; color: string }[];

/** Only used for the very first paint, before useChartWidth has
 * measured the card's real width. */
const FALLBACK_WIDTH = 480;
const HEIGHT = 140;
const PAD_LEFT = 6;
const PAD_RIGHT = 6;
const PAD_TOP = 4;
const PAD_BOTTOM = 16;
const STAGE_GAP = 2;
const BAR_FRACTION = 0.7;
const MIN_MOUTH_WIDTH = 10;
const MAX_MOUTH_WIDTH = 40;
/** A stage never fully disappears even at 0% — a hairline sliver stays
 * hoverable/visible instead of vanishing, e.g. a month with no
 * Investimentos at all. */
const MIN_STAGE_WIDTH = 2;
/** At most this many X labels — beyond it, only every Nth month is
 * labeled, so a 12-month (or longer custom) view doesn't crowd the axis
 * with overlapping text. */
const MAX_X_LABELS = 6;

/** One month's funnel: each stage's own value plus the running
 * remainder of Receita after it — the remainder (as a % of Receita)
 * drives that stage's width, so the shape narrows monotonically the
 * same way IncomeFlowFunnel's vertical bars do. Clamped to [0, 100] so
 * a deficit month (remainder goes negative) collapses to the width
 * floor instead of rendering "outside" the funnel — the real negative
 * value still shows in the tooltip regardless of the bar's width. */
function stagesFor(m: BudgetHistoryMonthRow) {
  const receita = m.receitaCents;
  let remainder = receita;
  return STAGE_DEFS.map((def) => {
    const value = m[def.key] as number;
    if (def.key !== "receitaCents") remainder -= def.key === "saldoCents" ? 0 : value;
    const pct = receita > 0 ? Math.min(Math.max((remainder / receita) * 100, 0), 100) : 0;
    const color = def.key === "saldoCents" ? (m.saldoCents >= 0 ? SALDO_POSITIVE_COLOR : SALDO_NEGATIVE_COLOR) : def.color;
    return { key: def.key, label: def.label, color, value, pct };
  });
}

/** "Evolução Financeira" — the "Visão Geral" income funnel
 * (IncomeFlowFunnel), recovered as a compact monthly strip: each month
 * gets its own miniature funnel (Receita → Custos Obrigatórios →
 * Prazeres e Confortos → Investimentos → Saldo, narrowing top to
 * bottom, each stage's width its remaining % of that month's own
 * Receita), and every month's funnel shares the same "mouth" width —
 * comparing the *shapes* left to right across the period is the point,
 * not comparing absolute R$ magnitude between months (that's what the
 * tooltip and the other historical cards are for). `useChartWidth`
 * keeps the SVG's internal coordinate system matched 1:1 to real screen
 * pixels regardless of the card's width (see that hook's own doc). */
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
  const stageHeight = (chartHeight - (STAGE_DEFS.length - 1) * STAGE_GAP) / STAGE_DEFS.length;

  const slotWidth = chartWidth / months.length;
  const mouthWidth = Math.min(MAX_MOUTH_WIDTH, Math.max(MIN_MOUTH_WIDTH, slotWidth * BAR_FRACTION));
  const xFor = (i: number) => PAD_LEFT + slotWidth * (i + 0.5);
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
          aria-label="Funil mensal de Receita, Custos Obrigatórios, Prazeres e Confortos, Investimentos e Saldo"
        >
          {months.map((m, i) => {
            const opacity = hovered === null || hovered === i ? 1 : 0.45;
            const stages = stagesFor(m);
            return (
              <g key={m.monthKey}>
                {stages.map((stage, s) => {
                  const width = Math.max(MIN_STAGE_WIDTH, (stage.pct / 100) * mouthWidth);
                  const y = PAD_TOP + s * (stageHeight + STAGE_GAP);
                  return (
                    <rect
                      key={stage.key}
                      x={xFor(i) - width / 2}
                      y={y}
                      width={width}
                      height={stageHeight}
                      rx={stageHeight / 2}
                      fill={stage.color}
                      opacity={opacity}
                    />
                  );
                })}
                {i % xLabelStep === 0 && (
                  <text x={xFor(i)} y={HEIGHT - 4} textAnchor="middle" className="fill-[var(--muted)] text-[8px]">
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
              {stagesFor(months[hovered]).map((stage) => (
                <div key={stage.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.label}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(stage.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
        {STAGE_DEFS.map((def) => (
          <span key={def.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: def.color }} />
            {def.label}
          </span>
        ))}
      </div>
    </div>
  );
}
