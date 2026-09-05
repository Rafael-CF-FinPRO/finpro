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
