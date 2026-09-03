import { Home, Sparkles, CreditCard, TrendingUp, type LucideIcon } from "lucide-react";
import type { Classification } from "@/generated/prisma/enums";

// One icon per budget classification, paired with CLASSIFICATION_COLORS.
// RECEITA never appears here (it doesn't participate in the budget
// distribution).
export const CLASSIFICATION_ICONS: Record<Exclude<Classification, "RECEITA">, LucideIcon> = {
  ESSENCIAIS: Home,
  NAO_ESSENCIAIS: Sparkles,
  DIVIDAS: CreditCard,
  INVESTIMENTOS: TrendingUp,
};
