import type { Classification } from "@/generated/prisma/enums";

// One distinct color per budget classification, shared by the pie chart
// and its legend. RECEITA never appears here (it doesn't participate in
// the budget distribution).
export const CLASSIFICATION_COLORS: Record<
  Exclude<Classification, "RECEITA">,
  string
> = {
  ESSENCIAIS: "#4f46e5",
  NAO_ESSENCIAIS: "#f59e0b",
  FINANCIAMENTOS: "#dc2626",
  INVESTIMENTOS: "#16a34a",
};
