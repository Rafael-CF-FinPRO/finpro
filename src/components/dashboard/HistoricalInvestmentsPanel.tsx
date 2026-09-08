"use client";

import { useState } from "react";
import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { computeBudgetPct } from "@/lib/budget-calc";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { useChartWidth } from "@/lib/use-chart-width";
import type { BudgetHistory } from "@/lib/budget";

const REALIZADO_COLOR = CLASSIFICATION_COLORS.INVESTIMENTOS;
const META_COLOR = "var(--primary)";

/** Only used for the very first paint, before useChartWidth has
 * measured the card's real width. */
const FALLBACK_WIDTH = 480;
const HEIGHT = 150;
const PAD_LEFT = 42;
const PAD_RIGHT = 6;
/** Extra headroom above the tallest bar/line point for its compact
 * "R$X · Y%" label. */
const PAD_TOP = 18;
const PAD_BOTTOM = 16;
const Y_TICKS = 3;
const BAR_FRACTION = 0.5;
const MIN_BAR_WIDTH = 4;
const MAX_BAR_WIDTH = 28;
const BAR_RADIUS = 3;
const MARKER_RADIUS = 2.5;
/** At most this many months get a value label above their bar (beyond
 * it, only every Nth one does) — same decluttering rule as the X-axis
 * month labels below, so a long custom period doesn't turn into a wall
 * of tiny overlapping text ("sem poluir o gráfico"). */
const MAX_VALUE_LABELS = 8;
const MAX_X_LABELS = 12;

function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) return `M${x},${y} h${width} v${height} h${-width} Z`;
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/** "Investimentos" — a combo chart (Realizado as bars, Meta/Orçado as a
 * line) plus 3 summary mini cards, replacing the old plain table. Every
 * number comes from the already-computed BudgetHistory — no new data,
 * no independent date-range logic — so it automatically inherits the
 * Visão Histórica's own rules: the period's real month-by-month figures
 * (per src/lib/budget.ts's getBudgetHistory), clamped to the user's
 * real first month of activity and to the exact custom range when one
 * is selected (a partial first/last month, day-clipped). `useChartWidth`
 * keeps the SVG's internal coordinate system matched 1:1 to real screen
 * pixels regardless of the card's width (see that hook's own doc). */
export function HistoricalInvestmentsPanel({ history }: { history: BudgetHistory }) {
  const { months, totals } = history;
  const [hovered, setHovered] = useState<number | null>(null);
  const { containerRef, width: WIDTH } = useChartWidth(FALLBACK_WIDTH);

  const avgInvestido = history.averages.investimentosCents;
  const pctAportes = computeBudgetPct(totals.investimentosCents, totals.receitaCents);

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Investimentos</p>

      {months.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Nenhum mês no período selecionado.</p>
      ) : (
        <>
          <InvestmentsChart
            months={months}
            hovered={hovered}
            setHovered={setHovered}
            width={WIDTH}
            containerRef={containerRef}
          />

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: REALIZADO_COLOR }} />
              Realizado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: META_COLOR }} />
              Meta / Orçado
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--surface-border)] px-3 py-2">
              <p className="text-xs text-[var(--muted)]">Investimento Médio</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{formatCentsToBRL(avgInvestido)}</p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] px-3 py-2">
              <p className="text-xs text-[var(--muted)]">Investimento Total do Período</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCentsToBRL(totals.investimentosCents)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--surface-border)] px-3 py-2">
              <p className="text-xs text-[var(--muted)]">Média % de Aportes</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {pctAportes === null ? "—" : `${pctAportes.toLocaleString("pt-BR")}%`}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InvestmentsChart({
  months,
  hovered,
  setHovered,
  width: WIDTH,
  containerRef,
}: {
  months: BudgetHistory["months"];
  hovered: number | null;
  setHovered: (i: number | null) => void;
  width: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const chartWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxValue = Math.max(
    ...months.flatMap((m) => [m.investimentosCents, m.investimentosMetaCents]),
    1
  );

  const slotWidth = chartWidth / months.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, slotWidth * BAR_FRACTION));
  const xFor = (i: number) => PAD_LEFT + slotWidth * (i + 0.5);
  const yFor = (value: number) => PAD_TOP + chartHeight - (value / maxValue) * chartHeight;

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (maxValue * i) / Y_TICKS);
  const xLabelStep = Math.max(1, Math.ceil(months.length / MAX_X_LABELS));
  const valueLabelStep = Math.max(1, Math.ceil(months.length / MAX_VALUE_LABELS));

  const linePoints = months.map((m, i) => `${xFor(i)},${yFor(m.investimentosMetaCents)}`).join(" ");

  return (
    <div ref={containerRef} className="relative mt-3">
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Investimento realizado e Meta ou Orçado por mês"
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
          const opacity = hovered === null || hovered === i ? 1 : 0.45;
          const barHeight = chartHeight - (yFor(m.investimentosCents) - PAD_TOP);
          const y = yFor(m.investimentosCents);
          const pct = computeBudgetPct(m.investimentosCents, m.investimentosMetaCents);
          const showLabel = i % valueLabelStep === 0 && m.investimentosCents > 0;

          return (
            <g key={m.monthKey}>
              {barHeight > 0 && (
                <path
                  d={roundedTopBarPath(xFor(i) - barWidth / 2, y, barWidth, barHeight, BAR_RADIUS)}
                  fill={REALIZADO_COLOR}
                  opacity={opacity}
                />
              )}
              {showLabel && (
                <text
                  x={xFor(i)}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-[var(--text-tertiary)] text-[7px] font-medium"
                >
                  {formatCentsCompactBRL(m.investimentosCents)}
                  {pct !== null ? ` · ${Math.round(pct)}%` : ""}
                </text>
              )}
              {i % xLabelStep === 0 && (
                <text x={xFor(i)} y={HEIGHT - 4} textAnchor="middle" className="fill-[var(--muted)] text-[8px]">
                  {m.shortLabel}
                </text>
              )}
            </g>
          );
        })}

        <polyline points={linePoints} fill="none" stroke={META_COLOR} strokeWidth={1.5} />
        {months.map((m, i) => (
          <circle
            key={m.monthKey}
            cx={xFor(i)}
            cy={yFor(m.investimentosMetaCents)}
            r={hovered === i ? MARKER_RADIUS + 1 : MARKER_RADIUS}
            fill="var(--surface)"
            stroke={META_COLOR}
            strokeWidth={1.5}
            opacity={hovered === null || hovered === i ? 1 : 0.45}
          />
        ))}

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
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                <span className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: META_COLOR }} />
                Meta / Orçado
              </span>
              <span className="font-medium text-[var(--text-primary)]">
                {formatCentsToBRL(months[hovered].investimentosMetaCents)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: REALIZADO_COLOR }} />
                Realizado
              </span>
              <span className="font-medium text-[var(--text-primary)]">
                {formatCentsToBRL(months[hovered].investimentosCents)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--surface-border)] pt-1">
              <span className="text-[var(--text-tertiary)]">% atingido</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {(() => {
                  const pct = computeBudgetPct(months[hovered].investimentosCents, months[hovered].investimentosMetaCents);
                  return pct === null ? "—" : `${pct.toLocaleString("pt-BR")}%`;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
