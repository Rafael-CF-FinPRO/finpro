import type { Classification } from "@/generated/prisma/enums";

// One distinct color per budget classification, shared by the pie chart
// and its legend. RECEITA never appears here (it doesn't participate in
// the budget distribution).
export const CLASSIFICATION_COLORS: Record<
  Exclude<Classification, "RECEITA">,
  string
> = {
  CUSTOS_OBRIGATORIOS: "#4f46e5",
  CONFORTOS: "#0ea5e9",
  PRAZERES: "#f59e0b",
  INVESTIMENTOS: "#16a34a",
  CONHECIMENTO: "#a855f7",
  METAS: "#ec4899",
};
