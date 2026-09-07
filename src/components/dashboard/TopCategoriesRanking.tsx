import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCategoryDisplayName } from "@/lib/category-display";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

const TOP_N = 10;

/** "Top 10 Categorias" — the categories that actually took the biggest
 * bite out of this month's spending, ranked by Realizado. Investimentos
 * is deliberately excluded (requirement: it isn't spending to rank —
 * it's a destination for money, tracked as a meta elsewhere on this
 * page). Bars are sized relative to the top category's value (a
 * comparison chart, not a per-category budget-utilization gauge), so
 * the relative size of each category's spending reads at a glance.
 * Doesn't filter to isActive categories: a category deactivated after
 * money was spent through it this month still genuinely was where that
 * money went — deactivation is a forward-looking budgeting choice, not
 * a correction of this month's history. */
export function TopCategoriesRanking({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const candidates = classifications
    .filter((cls) => cls.classification !== "INVESTIMENTOS")
    .flatMap((cls) =>
      cls.categories
        .filter((cat) => cat.realizedCents > 0)
        .map((cat) => ({ ...cat, classification: cls.classification }))
    );

  const top = withCategoryDisplayName(candidates)
    .sort((a, b) => b.realizedCents - a.realizedCents)
    .slice(0, TOP_N);

  const maxRealizedCents = top.reduce((max, c) => Math.max(max, c.realizedCents), 0);

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Top 10 Categorias</p>
      <p className="text-xs text-[var(--muted)]">Onde você mais gastou?</p>

      {top.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Nenhum gasto registrado neste mês.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {top.map((cat, i) => {
            const color = CLASSIFICATION_COLORS[cat.classification as NonReceita];
            const barWidth = maxRealizedCents > 0 ? (cat.realizedCents / maxRealizedCents) * 100 : 0;
            return (
              <div key={cat.categoryId} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-right text-xs font-semibold text-[var(--muted)]">
                  {i + 1}
                </span>
                <IconBadge icon={getCategoryIcon(cat.name)} color={color} variant="soft" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{cat.displayName}</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {formatCentsToBRL(cat.realizedCents)}
                    </p>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--control-track)]">
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
