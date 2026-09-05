import {
  computeBudgetPct,
  computeBudgetStatus,
  computeGoalStatus,
  isGoalClassification,
} from "@/lib/budget-calc";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCategoryDisplayName } from "@/lib/category-display";
import { IconBadge } from "@/components/orcamento/IconBadge";
import { StatusBadge } from "@/components/orcamento/StatusBadge";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

type Row = {
  key: string;
  name: string;
  classification: Classification;
  icon: ReturnType<typeof getCategoryIcon>;
  color: string;
  budgetedCents: number;
  realizedCents: number;
};

/** Shared cell content for "Diferença" — the one column whose meaning
 * flips between a limit classification (negative = over budget, bad)
 * and Investimentos (negative = goal surpassed, celebrated) — see
 * isGoalClassification in src/lib/budget-calc.ts. Matches the exact
 * wording asked for: "faltam", "Meta atingida", "Meta superada". */
function DiferencaCell({ row }: { row: Row }) {
  const diffCents = row.budgetedCents - row.realizedCents;
  if (!isGoalClassification(row.classification)) {
    return (
      <span className={diffCents < 0 ? "text-[var(--danger)]" : "text-stone-900"}>
        {formatCentsToBRL(diffCents)}
      </span>
    );
  }
  if (diffCents > 0) {
    return <span className="text-stone-900">Faltam {formatCentsToBRL(diffCents)}</span>;
  }
  if (diffCents === 0) {
    return <span className="font-medium text-[var(--success)]">Meta atingida</span>;
  }
  return (
    <span className="font-medium text-[var(--success)]">
      Meta superada em {formatCentsToBRL(Math.abs(diffCents))}
    </span>
  );
}

function StatusCell({ row }: { row: Row }) {
  if (isGoalClassification(row.classification)) {
    return <StatusBadge goalStatus={computeGoalStatus(row.realizedCents, row.budgetedCents)} />;
  }
  return <StatusBadge status={computeBudgetStatus(row.realizedCents, row.budgetedCents)} />;
}

/** "Orçamento × Realizado por Categoria" — one row per active category
 * that's actually part of this month's budget picture (has a defined
 * Orçamento/Meta or has real spending) — an unconfigured, untouched
 * category is just noise here. The classification-level totals (that
 * this panel used to also show via a toggle) now live in the Visão
 * Geral funnel above, so this panel is categories-only. Reuses the
 * exact goal-vs-limit rules already established in Orçamento
 * (src/components/orcamento/BudgetBoard.tsx): Custos Obrigatórios and
 * Prazeres e Confortos have a ceiling, Investimentos has a floor. Reads
 * only from the BudgetOverview already fetched by the Dashboard page —
 * no new data, no changes to the budget's own structure. */
export function BudgetVsRealizedPanel({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const rows: Row[] = withCategoryDisplayName(
    classifications.flatMap((cls) =>
      cls.categories
        .filter((cat) => cat.isActive && (cat.budgetedCents > 0 || cat.realizedCents > 0))
        .map((cat) => ({ ...cat, classification: cls.classification }))
    )
  ).map((cat) => ({
    key: cat.categoryId,
    name: cat.displayName,
    classification: cat.classification,
    icon: getCategoryIcon(cat.name),
    color: CLASSIFICATION_COLORS[cat.classification as NonReceita],
    budgetedCents: cat.budgetedCents,
    realizedCents: cat.realizedCents,
  }));

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-stone-700">Orçamento × Realizado por Categoria</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-left text-xs text-[var(--muted)]">
              <th className="pb-2 font-medium">Categoria</th>
              <th className="pb-2 font-medium">Meta</th>
              <th className="pb-2 font-medium">Realizado</th>
              <th className="pb-2 font-medium">Diferença</th>
              <th className="pb-2 font-medium">%</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-[var(--muted)]">
                  Nenhuma categoria com orçamento definido ou gastos neste mês.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const pct = computeBudgetPct(row.realizedCents, row.budgetedCents);
                return (
                  <tr key={row.key} className="border-b border-[var(--surface-border)] last:border-0">
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center gap-2 font-medium text-stone-900">
                        <IconBadge icon={row.icon} color={row.color} variant="soft" size="sm" />
                        {row.name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-stone-900">{formatCentsToBRL(row.budgetedCents)}</td>
                    <td className="py-2.5 pr-2 text-stone-900">{formatCentsToBRL(row.realizedCents)}</td>
                    <td className="py-2.5 pr-2">
                      <DiferencaCell row={row} />
                    </td>
                    <td className="py-2.5 pr-2 text-stone-900">
                      {pct === null ? "—" : `${pct.toLocaleString("pt-BR")}%`}
                    </td>
                    <td className="py-2.5">
                      <StatusCell row={row} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
