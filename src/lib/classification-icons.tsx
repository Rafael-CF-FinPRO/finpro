import { Home, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";
import type { Classification } from "@/generated/prisma/enums";

// One icon per budget classification, paired with CLASSIFICATION_COLORS.
// RECEITA never appears here (it doesn't participate in the budget
// distribution).
export const CLASSIFICATION_ICONS: Record<Exclude<Classification, "RECEITA">, LucideIcon> = {
  CUSTOS_OBRIGATORIOS: Home,
  PRAZERES_E_CONFORTOS: Sparkles,
  INVESTIMENTOS: TrendingUp,
};
