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

export function centsFromPercentage(baseCents: number, percentage: number): number {
  return Math.round((baseCents * percentage) / 100);
}

export function sumPercentages(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}
