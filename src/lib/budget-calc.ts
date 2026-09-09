import type { Classification } from "@/generated/prisma/enums";

export type BudgetStatus = "DENTRO" | "FORA";

/** The three personal-budget areas a user distributes their income
 * across: Custos Obrigatórios, Prazeres e Confortos, Investimentos.
 * Fixed and explicit (not derived from whatever categories happen to
 * exist) so every classification — including ones with no category under
 * them yet — is always shown and configurable. RECEITA is intentionally
 * excluded: it's income, not something the budget itself distributes. */
export const BUDGET_CLASSIFICATIONS: Classification[] = [
  "CUSTOS_OBRIGATORIOS",
  "PRAZERES_E_CONFORTOS",
  "INVESTIMENTOS",
];

export function computeBudgetStatus(realizedCents: number, budgetedCents: number): BudgetStatus {
  return realizedCents <= budgetedCents ? "DENTRO" : "FORA";
}

export type BudgetHealth = "COM_FOLGA" | "EM_ATENCAO" | "ESTOURADA";

const ATTENTION_THRESHOLD_PCT = 80;

/** A finer-grained read on a classification's spending than the binary
 * Dentro/Fora status: "com folga" while there's clear room left,
 * "em atenção" once it's close to the line, "estourada" once it's past
 * it. A classification with nothing budgeted yet is only "estourada" if
 * money was actually spent against it — otherwise there's nothing to
 * warn about. */
export function computeBudgetHealth(realizedCents: number, budgetedCents: number): BudgetHealth {
  if (budgetedCents <= 0) {
    return realizedCents > 0 ? "ESTOURADA" : "COM_FOLGA";
  }
  const pct = (realizedCents / budgetedCents) * 100;
  if (pct > 100) return "ESTOURADA";
  if (pct >= ATTENTION_THRESHOLD_PCT) return "EM_ATENCAO";
  return "COM_FOLGA";
}

/** Percentage (1 decimal place) of `realizedCents` over `budgetedCents`,
 * or null when there's nothing budgeted to compare against. */
export function computeBudgetPct(realizedCents: number, budgetedCents: number): number | null {
  if (budgetedCents === 0) return null;
  return Math.round((realizedCents / budgetedCents) * 1000) / 10;
}

/** Investimentos isn't a spend to cap — it's a savings goal to reach.
 * Every other classification (Custos Obrigatórios, Prazeres e
 * Confortos) keeps the "limite máximo" logic above (computeBudgetStatus/
 * computeBudgetHealth): exceeding the budgeted amount is bad. For
 * Investimentos, exceeding the target is the best possible outcome, so
 * it gets its own status/health concept below instead of reusing
 * BudgetStatus/BudgetHealth with a flipped meaning — DENTRO/FORA and
 * ESTOURADA always read as "this is bad" and would be misleading here
 * even recolored. Callers must check this and branch to
 * computeGoalStatus instead of computeBudgetStatus/computeBudgetHealth. */
export function isGoalClassification(classification: Classification): boolean {
  return classification === "INVESTIMENTOS";
}

export type GoalStatus = "EM_PROGRESSO" | "QUASE_LA" | "META_ATINGIDA";

const GOAL_CLOSE_THRESHOLD_PCT = 80;

/** Same three-tier granularity as computeBudgetHealth, but inverted:
 * the goal (`goalCents`) is a floor, not a ceiling, so reaching or
 * passing it is the good outcome, never "estourada". A goal of 0 (not
 * configured) is trivially reached by any amount actually invested. */
export function computeGoalStatus(realizedCents: number, goalCents: number): GoalStatus {
  if (goalCents <= 0) return realizedCents > 0 ? "META_ATINGIDA" : "EM_PROGRESSO";
  const pct = (realizedCents / goalCents) * 100;
  if (pct >= 100) return "META_ATINGIDA";
  if (pct >= GOAL_CLOSE_THRESHOLD_PCT) return "QUASE_LA";
  return "EM_PROGRESSO";
}

export function centsFromPercentage(baseCents: number, percentage: number): number {
  return Math.round((baseCents * percentage) / 100);
}

export function sumPercentages(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

/** How well a limit classification (Custos Obrigatórios, Prazeres e
 * Confortos) respected its ceiling, as a 0-100 score — 100 while at or
 * under budget, degrading as it's exceeded. Never negative and never
 * above 100: being well under budget isn't "extra compliant". Used by
 * the Dashboard's "Cumprimento do Orçamento" index. */
export function computeLimitCompliancePct(realizedCents: number, budgetedCents: number): number {
  if (budgetedCents <= 0) return realizedCents > 0 ? 0 : 100;
  if (realizedCents <= 0) return 100;
  return Math.min(100, Math.round((budgetedCents / realizedCents) * 100));
}

/** How well Investimentos reached its goal, as a 0-100 score — this is
 * the goal-classification counterpart to computeLimitCompliancePct.
 * Capped at 100 once the goal is reached: exceeding it is the best
 * outcome but never scores above full marks, so the overall index
 * (an average of all three) stays bounded. A goal of 0 (not
 * configured) is trivially fully compliant, same as computeGoalStatus. */
export function computeGoalCompliancePct(realizedCents: number, goalCents: number): number {
  if (goalCents <= 0) return 100;
  return Math.min(100, Math.round((realizedCents / goalCents) * 100));
}

/** Combines several already-computed compliance percentages (each from
 * computeLimitCompliancePct/computeGoalCompliancePct) into one overall
 * score, weighted by each row's own orçado — a bigger orçamento moves
 * the index more than a small one. Used twice by the Dashboard's
 * "Cumprimento do Orçamento": once to roll a classification's
 * categories up into that classification's score, and again to roll
 * the 3 classifications up into the overall index. A row with nothing
 * budgeted carries no weight; if NONE of the rows have anything
 * budgeted there's nothing to weigh, so this is trivially fully
 * compliant, same convention as the per-row functions above. */
export function computeWeightedCompliancePct(rows: { pct: number; budgetedCents: number }[]): number {
  const totalWeight = rows.reduce((sum, r) => sum + Math.max(r.budgetedCents, 0), 0);
  if (totalWeight <= 0) return 100;
  const weightedSum = rows.reduce((sum, r) => sum + r.pct * Math.max(r.budgetedCents, 0), 0);
  return Math.round(weightedSum / totalWeight);
}

/** Structural subset of ClassificationBudgetRow (src/lib/budget.ts) that
 * the compliance formulas below actually need — kept minimal here
 * rather than importing that type, since budget.ts already imports
 * from this file and a back-import would be circular. Any
 * ClassificationBudgetRow[] is assignable here as-is. */
export type ComplianceClassificationInput = {
  classification: Classification;
  budgetedCents: number;
  realizedCents: number;
  categories: { isActive: boolean; budgetedCents: number; realizedCents: number }[];
};

/** One classification's compliance score. When it has categories with
 * their own orçado defined, the score blends those categories'
 * compliance weighted by each one's own orçado (computeWeightedCompliancePct)
 * — money in a bigger category moves the classification's score more
 * than money in a small one. Whatever isn't attributed to a specifically
 * configured category — an inactive category's past spending (e.g. a
 * category deactivated after money was spent through it), or simply
 * money not yet broken down by category — still counts, folded in as
 * one more weighted row at the classification's own remaining
 * orçado/realizado, so a fully-compliant named category can never mask
 * overspending that happened elsewhere in the same classification. A
 * classification with no per-category orçamento configured at all (only
 * the classification-level % was set) falls back to scoring the
 * classification as a whole. Shared by the Dashboard's monthly
 * Cumprimento do Orçamento (BudgetComplianceScore) and its historical
 * month-by-month evolution (getBudgetHistory) — one formula, used both
 * places, never re-derived. */
export function computeClassificationCompliancePct(cls: ComplianceClassificationInput): number {
  const goal = isGoalClassification(cls.classification);
  const complianceOf = (realizedCents: number, budgetedCents: number) =>
    goal
      ? computeGoalCompliancePct(realizedCents, budgetedCents)
      : computeLimitCompliancePct(realizedCents, budgetedCents);

  const configuredCategories = cls.categories.filter((c) => c.isActive && c.budgetedCents > 0);
  if (configuredCategories.length === 0) {
    return complianceOf(cls.realizedCents, cls.budgetedCents);
  }

  const rows = configuredCategories.map((c) => ({
    pct: complianceOf(c.realizedCents, c.budgetedCents),
    budgetedCents: c.budgetedCents,
  }));

  const configuredBudgeted = configuredCategories.reduce((sum, c) => sum + c.budgetedCents, 0);
  const configuredRealized = configuredCategories.reduce((sum, c) => sum + c.realizedCents, 0);
  const remainderBudgeted = cls.budgetedCents - configuredBudgeted;
  if (remainderBudgeted > 0) {
    rows.push({
      pct: complianceOf(cls.realizedCents - configuredRealized, remainderBudgeted),
      budgetedCents: remainderBudgeted,
    });
  }

  return computeWeightedCompliancePct(rows);
}

/** The overall "Cumprimento do Orçamento" index (0-100): each
 * classification's own score (computeClassificationCompliancePct),
 * rolled up weighted by that classification's own orçado. */
export function computeOverallCompliancePct(classifications: ComplianceClassificationInput[]): number {
  return computeWeightedCompliancePct(
    classifications.map((cls) => ({
      pct: computeClassificationCompliancePct(cls),
      budgetedCents: cls.budgetedCents,
    }))
  );
}

export type ComplianceTier = "CRITICO" | "ATENCAO" | "BOM";

// Same 50/80 boundaries already drawn independently in
// ComplianceEvolutionChart.tsx's tierColorFor and
// BudgetComplianceScore.tsx's own tier logic (both untouched — this
// isn't a refactor of either) — the single source of truth for any
// *new* consumer of the same three-tier reading, so it never drifts
// from what those charts already show.
export function complianceTier(pct: number): ComplianceTier {
  if (pct >= 80) return "BOM";
  if (pct >= 50) return "ATENCAO";
  return "CRITICO";
}
