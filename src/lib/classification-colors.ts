import type { Classification } from "@/generated/prisma/enums";

// One distinct color per budget classification, shared by the pie chart
// and its legend. RECEITA never appears here (it doesn't participate in
// the budget distribution).
export const CLASSIFICATION_COLORS: Record<
  Exclude<Classification, "RECEITA">,
  string
> = {
  CUSTOS_OBRIGATORIOS: "#4f46e5",
  PRAZERES_E_CONFORTOS: "#f59e0b",
  INVESTIMENTOS: "#16a34a",
};

/** Appends an alpha channel to one of the hex colors above, so Category
 * rows can read as a soft tint of their parent Classification's color
 * (contrast between the two levels) without a second color palette to
 * maintain. `alphaHex` is a two-digit hex string, e.g. "14" (~8%) for a
 * background tint or "33" (~20%) for something that needs to read more
 * clearly, like an icon badge on a light background. */
export function withAlpha(hexColor: string, alphaHex: string): string {
  return `${hexColor}${alphaHex}`;
}
