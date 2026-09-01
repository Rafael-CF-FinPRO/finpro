import type { Classification } from "@/generated/prisma/enums";

export type BudgetStatus = "DENTRO" | "FORA";

/** The six personal-budget areas a user distributes their income across.
 * Fixed and explicit (not derived from whatever categories happen to
 * exist) so every classification — including ones with no category under
 * them yet, like Metas — is always shown and configurable. RECEITA is
 * intentionally excluded: it's income, not something the budget itself
 * distributes. */
export const BUDGET_CLASSIFICATIONS: Classification[] = [
  "CUSTOS_OBRIGATORIOS",
  "CONFORTOS",
  "PRAZERES",
  "INVESTIMENTOS",
  "CONHECIMENTO",
  "METAS",
];

export function computeBudgetStatus(realizedCents: number, budgetedCents: number): BudgetStatus {
  return realizedCents <= budgetedCents ? "DENTRO" : "FORA";
}

/** Percentage (1 decimal place) of `realizedCents` over `budgetedCents`,
 * or null when there's nothing budgeted to compare against. */
export function computeBudgetPct(realizedCents: number, budgetedCents: number): number | null {
  if (budgetedCents === 0) return null;
  return Math.round((realizedCents / budgetedCents) * 1000) / 10;
}

export function centsFromPercentage(baseCents: number, percentage: number): number {
  return Math.round((baseCents * percentage) / 100);
}

export function sumPercentages(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}
