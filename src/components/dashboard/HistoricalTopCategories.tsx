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
 * the displayed number and the toggle change. Given the most space of
 * any panel in Visão Histórica (section 5): thicker bars, larger name/
 * value text, and roomier row spacing so this is the easiest thing on
 * the page to scan. */
export function HistoricalTopCategories({ history }: { history: BudgetHistory }) {
  const [view, setView] = useState<"media" | "total">("media");

  const top = withCategoryDisplayName(history.categories)
    .sort((a, b) => b.totalRealizedCents - a.totalRealizedCents)
    .slice(0, TOP_N);

  const valueFor = (cat: (typeof top)[number]) =>
    view === "media" ? cat.avgRealizedCents : cat.totalRealizedCents;
  const maxValue = top.reduce((max, cat) => Math.max(max, valueFor(cat)), 0);

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-medium text-[var(--text-secondary)]">Top 10 Categorias</p>
          <p className="text-sm text-[var(--muted)]">Onde você mais gastou no período?</p>
        </div>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("media")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === "media" ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Média mensal
          </button>
          <button
            type="button"
            onClick={() => setView("total")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === "total" ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Total do período
          </button>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Nenhum gasto registrado no período.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {top.map((cat, i) => {
            const value = valueFor(cat);
            const color = CLASSIFICATION_COLORS[cat.classification as NonReceita];
            const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return (
              <div key={cat.categoryId} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-right text-sm font-semibold text-[var(--muted)]">
                  {i + 1}
                </span>
                <IconBadge icon={getCategoryIcon(cat.name)} color={color} variant="soft" size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="truncate text-base font-medium text-[var(--text-primary)]">{cat.displayName}</p>
                    <p className="text-base font-semibold text-[var(--text-primary)]">{formatCentsToBRL(value)}</p>
                  </div>
                  <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-full bg-[var(--control-track)]">
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
