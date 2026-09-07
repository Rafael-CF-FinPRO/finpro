import { formatCentsToBRL } from "@/lib/money";
import { computeBudgetStatus, computeGoalStatus, isGoalClassification } from "@/lib/budget-calc";
import { countMonthsWithData } from "@/lib/history-utils";
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
 * figures — same goal-vs-limit rules as everywhere else on the
 * Dashboard (Custos Obrigatórios/Prazeres e Confortos have a ceiling,
 * Investimentos has a floor, never penalized for exceeding it). Toggled
 * by the parent HistoricalOverviewCards between the period's monthly
 * average and its raw total — both derived here from the already-
 * computed per-month rows, no new data, no change to how any of those
 * figures are calculated. The average is over months that actually had
 * activity (countMonthsWithData), not the raw length of the selected
 * period, so a wide period with little real history isn't diluted by
 * empty months — same rule the backend uses for the summary strip
 * above; the total is unaffected by that (it's just a sum). Status
 * (Dentro/Fora, or the Investimentos goal tier) is computed from
 * whichever pair — média or total — is on screen: since both scale by
 * the same month count, the ratio between budgeted and realized is
 * identical either way, so the badge never flips with the toggle. */
export function HistoricalClassificationCards({
  months,
  view,
}: {
  months: BudgetHistoryMonthRow[];
  view: "media" | "total";
}) {
  const monthCount = countMonthsWithData(months);
  const suffix = view === "total" ? "Total" : "Médio";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ROWS.map(({ classification, budgeted, realized }) => {
        const totalBudgeted = months.reduce((sum, m) => sum + (m[budgeted] as number), 0);
        const totalRealized = months.reduce((sum, m) => sum + (m[realized] as number), 0);
        const budgetedValue = view === "total" ? totalBudgeted : Math.round(totalBudgeted / monthCount);
        const realizedValue = view === "total" ? totalRealized : Math.round(totalRealized / monthCount);
        const isGoal = isGoalClassification(classification);
        const diffCents = budgetedValue - realizedValue;
        const color = CLASSIFICATION_COLORS[classification as NonReceita];
        // The single source of truth for "is this good" — reused for
        // both the badge and the detail row below, so the two can never
        // disagree the way they used to when the row re-derived its own
        // achieved/not-achieved reading from diffCents alone (that
        // treated a not-yet-configured, R$0 meta with R$0 invested as
        // "atingida" even though computeGoalStatus — driving the badge
        // — correctly reads a genuine zero/zero as "Em progresso", not
        // an achievement).
        const goalStatus = isGoal ? computeGoalStatus(realizedValue, budgetedValue) : null;
        const goalAchieved = goalStatus === "META_ATINGIDA";

        return (
          <div key={classification} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <IconBadge icon={CLASSIFICATION_ICONS[classification as NonReceita]} color={color} size="sm" />
                {CLASSIFICATION_LABELS[classification]}
              </span>
              {isGoal ? (
                <StatusBadge goalStatus={goalStatus!} />
              ) : (
                <StatusBadge status={computeBudgetStatus(realizedValue, budgetedValue)} />
              )}
            </div>

            <p className="mt-2 text-sm text-[var(--muted)]">{isGoal ? `Meta ${suffix}` : `Orçado ${suffix}`}</p>
            <p className="text-lg font-semibold text-[var(--text-primary)]">{formatCentsToBRL(budgetedValue)}</p>

            <p className="mt-1 text-sm text-[var(--muted)]">Realizado {suffix}</p>
            <p className="text-lg font-semibold text-[var(--text-primary)]">{formatCentsToBRL(realizedValue)}</p>

            <p className="mt-1 text-sm text-[var(--muted)]">
              {isGoal
                ? goalAchieved
                  ? diffCents === 0
                    ? "Status"
                    : "Meta superada em"
                  : "Falta para a meta"
                : "Diferença"}
            </p>
            <p
              className={`text-lg font-semibold ${
                isGoal
                  ? goalAchieved
                    ? "text-[var(--success)]"
                    : "text-[var(--text-primary)]"
                  : diffCents < 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--text-primary)]"
              }`}
            >
              {isGoal && goalAchieved && diffCents === 0 ? "Meta atingida" : formatCentsToBRL(Math.abs(diffCents))}
            </p>
          </div>
        );
      })}
    </div>
  );
}
