"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCategoryDisplayName } from "@/lib/category-display";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { BudgetHistory } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

const TOP_N = 10;

/** "Top 10 Categorias" for the selected period — same comparison-bar
 * idea as the monthly view's ranking (bars sized relative to the top
 * category, Investimentos excluded), toggling whether the ranked value
 * is each category's average per month or its total across the whole
 * period. Averaging/totaling is just a constant scale factor
 * (÷ monthCount), so the ranking order is identical either way — only
 * the displayed number and the toggle change. */
export function HistoricalTopCategories({ history }: { history: BudgetHistory }) {
  const [view, setView] = useState<"media" | "total">("media");

  const top = withCategoryDisplayName(history.categories)
    .sort((a, b) => b.totalRealizedCents - a.totalRealizedCents)
    .slice(0, TOP_N);

  const valueFor = (cat: (typeof top)[number]) =>
    view === "media" ? cat.avgRealizedCents : cat.totalRealizedCents;
  const maxValue = top.reduce((max, cat) => Math.max(max, valueFor(cat)), 0);

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-stone-700">Top 10 Categorias</p>
          <p className="text-xs text-[var(--muted)]">Onde você mais gastou no período?</p>
        </div>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("media")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "media" ? "bg-[var(--primary)] text-white" : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            Média mensal
          </button>
          <button
            type="button"
            onClick={() => setView("total")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "total" ? "bg-[var(--primary)] text-white" : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            Total do período
          </button>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Nenhum gasto registrado no período.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {top.map((cat, i) => {
            const value = valueFor(cat);
            const color = CLASSIFICATION_COLORS[cat.classification as NonReceita];
            const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return (
              <div key={cat.categoryId} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-right text-xs font-semibold text-[var(--muted)]">
                  {i + 1}
                </span>
                <IconBadge icon={getCategoryIcon(cat.name)} color={color} variant="soft" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="truncate text-sm font-medium text-stone-900">{cat.displayName}</p>
                    <p className="text-sm font-semibold text-stone-900">{formatCentsToBRL(value)}</p>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full" style={{ width: `${barWidth}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
