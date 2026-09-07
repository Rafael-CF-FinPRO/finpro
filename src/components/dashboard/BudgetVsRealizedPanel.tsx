"use client";

import { useState } from "react";
import {
  computeBudgetPct,
  computeBudgetStatus,
  computeGoalStatus,
  isGoalClassification,
} from "@/lib/budget-calc";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCategoryDisplayName } from "@/lib/category-display";
import { IconBadge } from "@/components/orcamento/IconBadge";
import { StatusBadge } from "@/components/orcamento/StatusBadge";
import { BudgetComplianceScore } from "./BudgetComplianceScore";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

type Row = {
  key: string;
  name: string;
  classification: Classification;
  icon: ReturnType<typeof getCategoryIcon>;
  color: string;
  variant: "solid" | "soft";
  budgetedCents: number;
  realizedCents: number;
};

/** Shared cell content for "Diferença" — the one column whose meaning
 * flips between a limit classification (negative = over budget, bad)
 * and Investimentos (negative = goal surpassed, celebrated) — see
 * isGoalClassification in src/lib/budget-calc.ts. Matches the exact
 * wording asked for: "faltam", "Meta atingida", "Meta superada".
 * "Achieved" is read from computeGoalStatus (the same function driving
 * StatusCell's badge below) rather than re-derived from diffCents here
 * — diffCents alone got a genuine R$0 meta with R$0 invested wrong
 * (reading straight "meta atingida" from a 0-0 subtraction), while
 * computeGoalStatus correctly treats that as "not configured yet", the
 * same as the badge does. */
function DiferencaCell({ row }: { row: Row }) {
  const diffCents = row.budgetedCents - row.realizedCents;
  if (!isGoalClassification(row.classification)) {
    return (
      <span className={diffCents < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"}>
        {formatCentsToBRL(diffCents)}
      </span>
    );
  }
  const achieved = computeGoalStatus(row.realizedCents, row.budgetedCents) === "META_ATINGIDA";
  if (!achieved) {
    return <span className="text-[var(--text-primary)]">Faltam {formatCentsToBRL(diffCents)}</span>;
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

/** "Orçamento × Realizado" — toggles between one row per classification
 * and one row per category (only categories with a defined Meta and/or
 * real spending — an untouched, unconfigured category is just noise),
 * plus "Cumprimento do Orçamento" nested below the table (not a
 * separate "Saúde Orçamentária" section). Reuses the exact goal-vs-limit
 * rules already established in Orçamento (src/components/orcamento/
 * BudgetBoard.tsx): Custos Obrigatórios and Prazeres e Confortos have a
 * ceiling, Investimentos has a floor. Reads only from the BudgetOverview
 * already fetched by the Dashboard page — no new data, no changes to
 * the budget's own structure. */
export function BudgetVsRealizedPanel({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const [view, setView] = useState<"classificacoes" | "categorias">("classificacoes");

  const classificationRows: Row[] = classifications.map((cls) => ({
    key: cls.classification,
    name: CLASSIFICATION_LABELS[cls.classification],
    classification: cls.classification,
    icon: CLASSIFICATION_ICONS[cls.classification as NonReceita],
    color: CLASSIFICATION_COLORS[cls.classification as NonReceita],
    variant: "solid",
    budgetedCents: cls.budgetedCents,
    realizedCents: cls.realizedCents,
  }));

  const categoryRows: Row[] = withCategoryDisplayName(
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
    variant: "soft",
    budgetedCents: cat.budgetedCents,
    realizedCents: cat.realizedCents,
  }));

  const rows = view === "classificacoes" ? classificationRows : categoryRows;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Orçamento × Realizado</p>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("classificacoes")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "classificacoes"
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Classificações
          </button>
          <button
            type="button"
            onClick={() => setView("categorias")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "categorias"
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--surface-border)] text-left text-xs text-[var(--muted)]">
              <th className="pb-2 font-medium">{view === "classificacoes" ? "Classificação" : "Categoria"}</th>
              <th className="pb-2 font-medium">{view === "classificacoes" ? "Orçamento" : "Meta"}</th>
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
                      <span className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                        <IconBadge icon={row.icon} color={row.color} variant={row.variant} size="sm" />
                        {row.name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-[var(--text-primary)]">{formatCentsToBRL(row.budgetedCents)}</td>
                    <td className="py-2.5 pr-2 text-[var(--text-primary)]">{formatCentsToBRL(row.realizedCents)}</td>
                    <td className="py-2.5 pr-2">
                      <DiferencaCell row={row} />
                    </td>
                    <td className="py-2.5 pr-2 text-[var(--text-primary)]">
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

      <BudgetComplianceScore classifications={classifications} />
    </div>
  );
}
