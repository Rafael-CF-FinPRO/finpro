"use client";

import { useState } from "react";
import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { BUDGET_CLASSIFICATIONS, computeBudgetPct } from "@/lib/budget-calc";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { withCategoryDisplayName } from "@/lib/category-display";
import { useChartWidth } from "@/lib/use-chart-width";
import type { BudgetHistoryMonthRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;
type ViewMode = "classificacoes" | "categorias";
type Segment = { key: string; label: string; color: string };

/** Only used for the very first paint, before useChartWidth has
 * measured the card's real width. */
const FALLBACK_WIDTH = 480;
const HEIGHT = 132;
const PAD_LEFT = 42;
const PAD_RIGHT = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 16;
const Y_TICKS = 3;
/** Fraction of each month's slot given to the Realizado+Orçado pair
 * together (the rest is breathing room between months). */
const PAIR_FRACTION = 0.7;
/** Gap between the two bars within one month's pair. */
const PAIR_GAP = 3;
const MIN_BAR_WIDTH = 3;
const MAX_BAR_WIDTH = 18;
const BAR_RADIUS = 2;
const LEGEND_CAP = 10;
/** At most this many X labels — same decluttering rule as the other
 * historical charts (section 3: eixos sem excesso de marcações); a long
 * custom period (up to 24 months) would otherwise cram every month's
 * label under narrow bars until they overlap. */
const MAX_X_LABELS = 12;

/** Path for a bar segment with rounded top corners and a square bottom
 * — used only for a bar's topmost visible segment, so a stack reads as
 * one rounded pill made of colored bands rather than a sharp block.
 * Every lower segment keeps rendering as a plain <rect>. */
function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height);
  if (r <= 0) return `M${x},${y} h${width} v${height} h${-width} Z`;
  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
}

/** "Distribuição dos Gastos" — for each month, two side-by-side stacked
 * columns on the same R$ scale: Realizado (what was actually spent/
 * invested) and Orçado (what was budgeted for that same classification/
 * category that month) — Custos Obrigatórios, Prazeres e Confortos and
 * Investimentos, no Saldo segment, same framing as the monthly view's
 * own ValueDistributionDonut. Investimentos keeps its own segment
 * (never folded into Custos/Prazeres) — it's a destination for money,
 * not consumption, but still counts as "distributed" that month.
 * Toggles to a per-category breakdown the same way Orçamento ×
 * Realizado does; a category shows up as soon as it has either
 * Realizado or Orçado that month, so a budgeted-but-unspent category
 * still gets its (empty) Realizado bar and its Orçado bar. Hovering a
 * month shows one combined card comparing every segment's Realizado ×
 * Orçado, their difference and % de utilização — not two separate
 * tooltips for the two bars. `useChartWidth` keeps the SVG's internal
 * coordinate system matched 1:1 to real screen pixels regardless of the
 * card's width (see that hook's own doc). */
export function SpendingDistributionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
  const [view, setView] = useState<ViewMode>("classificacoes");
  const [hovered, setHovered] = useState<number | null>(null);
  const { containerRef, width: WIDTH } = useChartWidth(FALLBACK_WIDTH);

  if (months.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum mês no período selecionado.
      </div>
    );
  }

  const classificationSegments: Segment[] = BUDGET_CLASSIFICATIONS.map((classification) => ({
    key: classification,
    label: CLASSIFICATION_LABELS[classification],
    color: CLASSIFICATION_COLORS[classification as NonReceita],
  }));

  // Every category with any realized spending and/or budget allocation
  // across the period, kept in a fixed order (grouped by classification,
  // biggest realized first) so the same category occupies a similar
  // band from one month's bars to the next instead of shuffling around.
  const categoryTotals = new Map<
    string,
    { categoryId: string; name: string; classification: Classification; total: number }
  >();
  for (const m of months) {
    for (const cat of m.categories) {
      const existing = categoryTotals.get(cat.categoryId);
      if (existing) {
        existing.total += cat.realizedCents;
      } else {
        categoryTotals.set(cat.categoryId, { ...cat, total: cat.realizedCents });
      }
    }
  }
  const orderedCategories = withCategoryDisplayName([...categoryTotals.values()]).sort((a, b) => {
    const rank = (c: Classification) => BUDGET_CLASSIFICATIONS.indexOf(c);
    return rank(a.classification) - rank(b.classification) || b.total - a.total;
  });
  const categorySegments: Segment[] = orderedCategories.map((c) => ({
    key: c.categoryId,
    label: c.displayName,
    color: CLASSIFICATION_COLORS[c.classification as NonReceita],
  }));

  const segments = view === "classificacoes" ? classificationSegments : categorySegments;

  function realizedFor(m: BudgetHistoryMonthRow, segmentKey: string): number {
    if (view === "classificacoes") {
      if (segmentKey === "CUSTOS_OBRIGATORIOS") return m.custosCents;
      if (segmentKey === "PRAZERES_E_CONFORTOS") return m.prazeresCents;
      return m.investimentosCents;
    }
    return m.categories.find((c) => c.categoryId === segmentKey)?.realizedCents ?? 0;
  }

  function budgetedFor(m: BudgetHistoryMonthRow, segmentKey: string): number {
    if (view === "classificacoes") {
      if (segmentKey === "CUSTOS_OBRIGATORIOS") return m.custosBudgetedCents;
      if (segmentKey === "PRAZERES_E_CONFORTOS") return m.prazeresBudgetedCents;
      return m.investimentosMetaCents;
    }
    return m.categories.find((c) => c.categoryId === segmentKey)?.budgetedCents ?? 0;
  }

  const monthRealizedTotals = months.map((m) => segments.reduce((sum, seg) => sum + realizedFor(m, seg.key), 0));
  const monthBudgetedTotals = months.map((m) => segments.reduce((sum, seg) => sum + budgetedFor(m, seg.key), 0));
  const maxTotal = Math.max(...monthRealizedTotals, ...monthBudgetedTotals, 1);

  const chartWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slotWidth = chartWidth / months.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, (slotWidth * PAIR_FRACTION - PAIR_GAP) / 2));
  const xFor = (i: number) => PAD_LEFT + slotWidth * (i + 0.5);
  const realizedXFor = (i: number) => xFor(i) - PAIR_GAP / 2 - barWidth;
  const budgetedXFor = (i: number) => xFor(i) + PAIR_GAP / 2;
  const yFor = (value: number) => PAD_TOP + chartHeight - (value / maxTotal) * chartHeight;
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (maxTotal * i) / Y_TICKS);
  const xLabelStep = Math.max(1, Math.ceil(months.length / MAX_X_LABELS));

  const hoveredSegments =
    hovered === null
      ? []
      : segments
          .map((seg) => ({
            ...seg,
            realized: realizedFor(months[hovered], seg.key),
            budgeted: budgetedFor(months[hovered], seg.key),
          }))
          .filter((seg) => seg.realized > 0 || seg.budgeted > 0)
          .sort((a, b) => b.realized - a.realized);

  /** One bar's stacked segments for a given month — shared between the
   * Realizado and Orçado columns, only the value-lookup function and X
   * position differ. */
  function renderBar(m: BudgetHistoryMonthRow, x: number, i: number, valueFor: (m: BudgetHistoryMonthRow, key: string) => number) {
    let cumulative = 0;
    const topSegmentKey = segments.filter((seg) => valueFor(m, seg.key) > 0).at(-1)?.key;
    const opacity = hovered === null || hovered === i ? 1 : 0.45;
    return segments.map((seg) => {
      const value = valueFor(m, seg.key);
      if (value <= 0) return null;
      const y = yFor(cumulative + value);
      const segHeight = yFor(cumulative) - y;
      cumulative += value;
      return seg.key === topSegmentKey ? (
        <path key={seg.key} d={roundedTopBarPath(x, y, barWidth, segHeight, BAR_RADIUS)} fill={seg.color} opacity={opacity} />
      ) : (
        <rect key={seg.key} x={x} y={y} width={barWidth} height={segHeight} fill={seg.color} opacity={opacity} />
      );
    });
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Distribuição dos Gastos</p>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("classificacoes")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "classificacoes" ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Classificações
          </button>
          <button
            type="button"
            onClick={() => setView("categorias")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "categorias" ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--text-tertiary)]" /> Realizado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--text-tertiary)] opacity-35" /> Orçado
        </span>
      </div>

      <div ref={containerRef} className="relative mt-2">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Distribuição mensal dos gastos realizados comparados ao orçamento"
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

          {months.map((m, i) => (
            <g key={m.monthKey}>
              {renderBar(m, realizedXFor(i), i, realizedFor)}
              <g opacity={0.35}>{renderBar(m, budgetedXFor(i), i, budgetedFor)}</g>
              {i % xLabelStep === 0 && (
                <text x={xFor(i)} y={HEIGHT - 4} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
                  {m.shortLabel}
                </text>
              )}
            </g>
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
            className={`pointer-events-none absolute top-1 z-10 max-h-[260px] w-64 overflow-y-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-[11px] shadow-lg ${
              hovered <= 1 ? "" : hovered >= months.length - 2 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${(xFor(hovered) / WIDTH) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-[var(--text-primary)]">{formatMonthKeyLabel(months[hovered].monthKey)}</p>
            <div className="space-y-1.5">
              {hoveredSegments.length === 0 ? (
                <p className="text-[var(--muted)]">Sem valores no mês.</p>
              ) : (
                hoveredSegments.map((seg) => {
                  const diffCents = seg.budgeted - seg.realized;
                  // Participação do item no total do mês — não a mesma
                  // coisa que "% utilizado do próprio orçamento do item"
                  // (essa métrica não aparece mais aqui): realizedPct usa
                  // o total realizado do mês como denominador,
                  // budgetedPct usa o total orçado do mês, cada um "—"
                  // quando esse total é R$ 0,00.
                  const realizedPct = computeBudgetPct(seg.realized, monthRealizedTotals[hovered]);
                  const budgetedPct = computeBudgetPct(seg.budgeted, monthBudgetedTotals[hovered]);
                  return (
                    <div key={seg.key}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1 text-[var(--text-tertiary)]">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                          <span className={view === "categorias" ? "truncate" : ""}>{seg.label}</span>
                        </span>
                        <span className="shrink-0 font-medium text-[var(--text-primary)]">
                          {formatCentsToBRL(seg.realized)} — {realizedPct === null ? "—" : `${realizedPct.toLocaleString("pt-BR")}%`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-2.5 text-[var(--muted)]">
                        <span>
                          Orçado {formatCentsToBRL(seg.budgeted)} —{" "}
                          {budgetedPct === null ? "—" : `${budgetedPct.toLocaleString("pt-BR")}%`}
                        </span>
                        <span className={diffCents < 0 ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"}>
                          {formatCentsToBRL(diffCents)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-1.5 space-y-0.5 border-t border-[var(--surface-border)] pt-1">
              <div className="flex items-center justify-between gap-2 font-semibold text-[var(--text-primary)]">
                <span>Total realizado</span>
                <span>{formatCentsToBRL(monthRealizedTotals[hovered])}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[var(--muted)]">
                <span>Total orçado</span>
                <span>{formatCentsToBRL(monthBudgetedTotals[hovered])}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {view === "classificacoes" ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
          {segments.map((seg) => (
            <span key={seg.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--muted)] sm:grid-cols-3">
          {segments.slice(0, LEGEND_CAP).map((seg) => (
            <span key={seg.key} className="flex items-center gap-1.5 truncate">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="truncate">{seg.label}</span>
            </span>
          ))}
          {segments.length > LEGEND_CAP && (
            <span className="text-[var(--text-faint)]">+{segments.length - LEGEND_CAP} categorias</span>
          )}
        </div>
      )}
    </div>
  );
}
