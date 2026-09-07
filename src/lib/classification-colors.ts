import type { Classification } from "@/generated/prisma/enums";

// One distinct color identity per budget classification, shared by
// every chart/badge/legend in the app. Defined as CSS custom properties
// in src/app/globals.css (light + dark values) rather than literal hex,
// so every consumer — fill=, style={{backgroundColor}}, Tailwind
// arbitrary-value classes — automatically tracks the active theme with
// no per-component branching. RECEITA and NEUTRA never appear here —
// neither participates in the budget distribution.
export const CLASSIFICATION_COLORS: Record<
  Exclude<Classification, "RECEITA" | "NEUTRA">,
  string
> = {
  CUSTOS_OBRIGATORIOS: "var(--classification-custos)",
  PRAZERES_E_CONFORTOS: "var(--classification-prazeres)",
  INVESTIMENTOS: "var(--classification-investimentos)",
};

/** Blends one of the colors above toward transparent, so Category rows
 * can read as a soft tint of their parent Classification's color
 * (contrast between the two levels) without a second color palette to
 * maintain. `percent` is how much of the original color remains (e.g.
 * 15 for a subtle background tint) — color-mix() rather than a hex
 * alpha suffix because these colors are CSS var() references, not
 * literal hex strings a suffix could append to. */
export function withAlpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
