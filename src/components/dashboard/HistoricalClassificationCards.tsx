import { formatCentsToBRL } from "@/lib/money";
import { computeBudgetStatus, computeGoalStatus, isGoalClassification } from "@/lib/budget-calc";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
import { StatusBadge } from "@/components/orcamento/StatusBadge";
import type { BudgetHistoryMonthRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

const ROWS: {
  classification: Classification;
  budgeted: keyof BudgetHistoryMonthRow;
  realized: keyof BudgetHistoryMonthRow;
}[] = [
  { classification: "CUSTOS_OBRIGATORIOS", budgeted: "custosBudgetedCents", realized: "custosCents" },
  { classification: "PRAZERES_E_CONFORTOS", budgeted: "prazeresBudgetedCents", realized: "prazeresCents" },
  { classification: "INVESTIMENTOS", budgeted: "investimentosMetaCents", realized: "investimentosCents" },
];

/** The 3 classification cards, right below the period's 4 headline
 * averages — same goal-vs-limit rules as everywhere else on the
 * Dashboard (Custos Obrigatórios/Prazeres e Confortos have a ceiling,
 * Investimentos has a floor, never penalized for exceeding it). Values
 * are period averages (Orçado/Meta Médio, Realizado Médio), derived
 * here from the already-computed per-month rows — no new data, no
 * change to how any of those figures are calculated. */
export function HistoricalClassificationCards({ months }: { months: BudgetHistoryMonthRow[] }) {
  const monthCount = Math.max(months.length, 1);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ROWS.map(({ classification, budgeted, realized }) => {
        const avgBudgeted = Math.round(
          months.reduce((sum, m) => sum + (m[budgeted] as number), 0) / monthCount
        );
        const avgRealized = Math.round(
          months.reduce((sum, m) => sum + (m[realized] as number), 0) / monthCount
        );
        const isGoal = isGoalClassification(classification);
        const diffCents = avgBudgeted - avgRealized;
        const color = CLASSIFICATION_COLORS[classification as NonReceita];

        return (
          <div key={classification} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-stone-900">
                <IconBadge icon={CLASSIFICATION_ICONS[classification as NonReceita]} color={color} size="sm" />
                {CLASSIFICATION_LABELS[classification]}
              </span>
              {isGoal ? (
                <StatusBadge goalStatus={computeGoalStatus(avgRealized, avgBudgeted)} />
              ) : (
                <StatusBadge status={computeBudgetStatus(avgRealized, avgBudgeted)} />
              )}
            </div>

            <p className="mt-2 text-sm text-[var(--muted)]">{isGoal ? "Meta Média" : "Orçado Médio"}</p>
            <p className="text-lg font-semibold text-stone-900">{formatCentsToBRL(avgBudgeted)}</p>

            <p className="mt-1 text-sm text-[var(--muted)]">Realizado Médio</p>
            <p className="text-lg font-semibold text-stone-900">{formatCentsToBRL(avgRealized)}</p>

            <p className="mt-1 text-sm text-[var(--muted)]">
              {isGoal
                ? diffCents === 0
                  ? "Status"
                  : diffCents < 0
                    ? "Meta superada em"
                    : "Falta para a meta"
                : "Diferença"}
            </p>
            <p
              className={`text-lg font-semibold ${
                isGoal
                  ? diffCents <= 0
                    ? "text-[var(--success)]"
                    : "text-stone-900"
                  : diffCents < 0
                    ? "text-[var(--danger)]"
                    : "text-stone-900"
              }`}
            >
              {isGoal && diffCents === 0 ? "Meta atingida" : formatCentsToBRL(Math.abs(diffCents))}
            </p>
          </div>
        );
      })}
    </div>
  );
}
