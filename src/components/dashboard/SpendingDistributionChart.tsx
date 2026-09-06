"use client";

import { useState } from "react";
import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { BUDGET_CLASSIFICATIONS } from "@/lib/budget-calc";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { withCategoryDisplayName } from "@/lib/category-display";
import type { BudgetHistoryMonthRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;
type ViewMode = "classificacoes" | "categorias";
type Segment = { key: string; label: string; color: string };

const BAR_WIDTH = 26;
const GAP = 12;
const CHART_HEIGHT = 190;
const TOP_MARGIN = 10;
const BOTTOM_MARGIN = 20;
const Y_TICKS = 3;
const LEGEND_CAP = 10;
/** At most this many X labels — same decluttering rule as the other
 * historical charts (section 3: eixos sem excesso de marcações); a long
 * custom period (up to 24 months) would otherwise cram every month's
 * label under narrow bars until they overlap. */
const MAX_X_LABELS = 12;

/** "Distribuição dos Gastos" — for each month, how the money actually
 * spent/invested that month broke down, as a stacked column in R$ (not
 * %, and no Saldo segment — this chart is only about the 3 gasto/
 * destinação categories, income and leftover live in the other
 * sections). Investimentos is included as one of the 3 segments — it's
 * a destination for money, not consumption, but it still counts toward
 * "how this month's realized values were distributed", same framing as
 * the monthly view's own ValueDistributionDonut. Toggles to a
 * per-category breakdown the same way Orçamento × Realizado and
 * ValueDistributionDonut do. Hovering a column shows every segment's
 * value for that month as one card (not per-segment isolated tooltips),
 * including the individual category breakdown when in Categorias mode. */
export function SpendingDistributionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
  const [view, setView] = useState<ViewMode>("classificacoes");
  const [hovered, setHovered] = useState<number | null>(null);

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

  // Every category with any realized spending across the period, kept
  // in a fixed order (grouped by classification, biggest first) so the
  // same category occupies a similar band from one month's bar to the
  // next instead of shuffling around.
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

  function valueFor(m: BudgetHistoryMonthRow, segmentKey: string): number {
    if (view === "classificacoes") {
      if (segmentKey === "CUSTOS_OBRIGATORIOS") return m.custosCents;
      if (segmentKey === "PRAZERES_E_CONFORTOS") return m.prazeresCents;
      return m.investimentosCents;
    }
    return m.categories.find((c) => c.categoryId === segmentKey)?.realizedCents ?? 0;
  }

  const monthTotals = months.map((m) => segments.reduce((sum, seg) => sum + valueFor(m, seg.key), 0));
  const maxTotal = Math.max(...monthTotals, 1);

  const width = months.length * (BAR_WIDTH + GAP) + GAP;
  const height = CHART_HEIGHT + TOP_MARGIN + BOTTOM_MARGIN;
  const padLeft = 44;
  const totalWidth = width + padLeft;
  const yFor = (value: number) => (value / maxTotal) * CHART_HEIGHT;
  const baselineY = TOP_MARGIN + CHART_HEIGHT;
  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => (maxTotal * i) / Y_TICKS);
  const columnFor = (i: number) => padLeft + GAP + i * (BAR_WIDTH + GAP);
  const xLabelStep = Math.max(1, Math.ceil(months.length / MAX_X_LABELS));

  const hoveredSegments =
    hovered === null
      ? []
      : segments
          .map((seg) => ({ ...seg, value: valueFor(months[hovered], seg.key) }))
          .filter((seg) => seg.value > 0)
          .sort((a, b) => b.value - a.value);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-700">Distribuição dos Gastos</p>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("classificacoes")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "classificacoes" ? "bg-[var(--primary)] text-white" : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            Classificações
          </button>
          <button
            type="button"
            onClick={() => setView("categorias")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "categorias" ? "bg-[var(--primary)] text-white" : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${totalWidth} ${height}`}
          className="w-full"
          role="img"
          aria-label="Distribuição mensal dos gastos e investimentos realizados"
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={padLeft}
                x2={totalWidth}
                y1={baselineY - yFor(tick)}
                y2={baselineY - yFor(tick)}
                stroke="var(--surface-border)"
                strokeWidth={1}
              />
              <text x={padLeft - 6} y={baselineY - yFor(tick) + 3} textAnchor="end" className="fill-stone-400 text-[8px]">
                {formatCentsCompactBRL(tick)}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const x = columnFor(i);
            let cumulative = 0;
            return (
              <g key={m.monthKey}>
                {segments.map((seg) => {
                  const value = valueFor(m, seg.key);
                  if (value <= 0) return null;
                  const segHeight = yFor(value);
                  const y = baselineY - yFor(cumulative) - segHeight;
                  cumulative += value;
                  return (
                    <rect
                      key={seg.key}
                      x={x}
                      y={y}
                      width={BAR_WIDTH}
                      height={segHeight}
                      fill={seg.color}
                      opacity={hovered === null || hovered === i ? 1 : 0.45}
                    />
                  );
                })}
                {i % xLabelStep === 0 && (
                  <text x={x + BAR_WIDTH / 2} y={height - 4} textAnchor="middle" className="fill-stone-500 text-[8px]">
                    {m.shortLabel}
                  </text>
                )}
              </g>
            );
          })}

          {months.map((m, i) => (
            <rect
              key={m.monthKey}
              x={columnFor(i) - GAP / 2}
              y={0}
              width={BAR_WIDTH + GAP}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {hovered !== null && (
          <div
            className={`pointer-events-none absolute top-1 z-10 max-h-[220px] overflow-y-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-[11px] shadow-lg ${
              view === "categorias" ? "w-52" : "w-44"
            } ${hovered <= 1 ? "" : hovered >= months.length - 2 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${((columnFor(hovered) + BAR_WIDTH / 2) / totalWidth) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-stone-900">{formatMonthKeyLabel(months[hovered].monthKey)}</p>
            <div className="space-y-0.5">
              {hoveredSegments.length === 0 ? (
                <p className="text-stone-500">Sem valores no mês.</p>
              ) : (
                hoveredSegments.map((seg) => (
                  <div key={seg.key} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-stone-600">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className={view === "categorias" ? "truncate" : ""}>{seg.label}</span>
                    </span>
                    <span className="shrink-0 font-medium text-stone-900">{formatCentsToBRL(seg.value)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-[var(--surface-border)] pt-1 font-semibold text-stone-900">
              <span>Total</span>
              <span>{formatCentsToBRL(monthTotals[hovered])}</span>
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
            <span className="text-stone-400">+{segments.length - LEGEND_CAP} categorias</span>
          )}
        </div>
      )}
    </div>
  );
}
