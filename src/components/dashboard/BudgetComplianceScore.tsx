import {
  computeGoalCompliancePct,
  computeLimitCompliancePct,
  isGoalClassification,
} from "@/lib/budget-calc";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

function tierFor(pct: number): { label: string; color: string; bg: string } {
  if (pct >= 80) return { label: "Bom", color: "var(--success)", bg: "var(--success-bg)" };
  if (pct >= 50) return { label: "Atenção", color: "var(--warning)", bg: "var(--warning-bg)" };
  return { label: "Crítico", color: "var(--danger)", bg: "var(--danger-bg)" };
}

/** "Cumprimento do Orçamento" — one index (0-100) summarizing how well
 * the month followed the budget, averaging a compliance score per
 * classification. Custos Obrigatórios and Prazeres e Confortos score by
 * how well they respected their ceiling; Investimentos scores by how
 * close it got to its goal, capped at 100 once reached — exceeding it
 * never lowers the index and never needs to "make up" for anything, see
 * computeGoalCompliancePct in src/lib/budget-calc.ts. */
export function BudgetComplianceScore({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const scores = classifications.map((cls) => ({
    classification: cls.classification,
    pct: isGoalClassification(cls.classification)
      ? computeGoalCompliancePct(cls.realizedCents, cls.budgetedCents)
      : computeLimitCompliancePct(cls.realizedCents, cls.budgetedCents),
  }));

  const overall =
    scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.pct, 0) / scores.length) : 100;
  const tier = tierFor(overall);

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-stone-700">Cumprimento do Orçamento</p>

      <div className="mt-3 flex items-center gap-4">
        <p className="text-3xl font-bold" style={{ color: tier.color }}>
          {overall}%
        </p>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: tier.bg, color: tier.color }}
        >
          {tier.label}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(Math.max(overall, 0), 100)}%`, backgroundColor: tier.color }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {scores.map((s) => (
          <div
            key={s.classification}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5 font-medium text-stone-700">
              <IconBadge
                icon={CLASSIFICATION_ICONS[s.classification as NonReceita]}
                color={CLASSIFICATION_COLORS[s.classification as NonReceita]}
                variant="soft"
                size="sm"
              />
              {CLASSIFICATION_LABELS[s.classification]}
            </span>
            <span className="font-semibold text-stone-900">{s.pct}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Custos Obrigatórios e Prazeres e Confortos: quanto mais dentro do limite, melhor. Investimentos:
        quanto mais perto ou acima da meta, melhor — nunca penalizado por superá-la.
      </p>
    </div>
  );
}
