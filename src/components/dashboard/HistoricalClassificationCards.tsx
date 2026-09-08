import { formatCentsToBRL } from "@/lib/money";
import { computeBudgetPct, computeBudgetStatus, computeGoalStatus, isGoalClassification } from "@/lib/budget-calc";
import { countMonthsWithData } from "@/lib/history-utils";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
import { StatusBadge } from "@/components/orcamento/StatusBadge";
import type { BudgetHistoryMonthRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** A compact "how much of the budget/meta" ring — the same percentage
 * already on the card (realizado ÷ orçado/meta), just made visual
 * instead of read only from R$ figures. Sized to sit beside the card's
 * existing text column (never below it), so the card's height is
 * whatever that text column already needs — the ring never grows it.
 * `pct` beyond 100 still fills the ring only up to a full circle (it
 * can't sweep past 360°), but the center label keeps showing the real
 * number, since going over is exactly what "Fora do orçamento" needs to
 * communicate. `pct === null` (no orçado/meta configured) renders an
 * empty track with "—" instead of a divide-by-zero percentage. */
function ProgressRing({ pct, color }: { pct: number | null; color: string }) {
  const clamped = pct === null ? 0 : Math.min(Math.max(pct, 0), 100);
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <g transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}>
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--surface-border)"
            strokeWidth={RING_STROKE}
          />
          {pct !== null && (
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          )}
        </g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {pct === null ? (
          <span className="text-sm font-semibold text-[var(--text-faint)]">—</span>
        ) : (
          <span className="text-sm font-bold text-[var(--text-primary)]">{Math.round(pct)}%</span>
        )}
      </div>
    </div>
  );
}

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
        const budgetStatus = !isGoal ? computeBudgetStatus(realizedValue, budgetedValue) : null;
        // Same realizado/orçado ratio already driving the badge above —
        // null (not formatted as 0%) whenever there's nothing budgeted/
        // metado to divide by, so the ring reads "—" instead of a
        // fabricated percentage.
        const pct = computeBudgetPct(realizedValue, budgetedValue);
        const ringColor = isGoal
          ? goalStatus === "META_ATINGIDA"
            ? "var(--success)"
            : goalStatus === "QUASE_LA"
              ? "var(--warning)"
              : "var(--neutral)"
          : budgetStatus === "DENTRO"
            ? "var(--success)"
            : "var(--danger)";

        return (
          <div key={classification} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <IconBadge icon={CLASSIFICATION_ICONS[classification as NonReceita]} color={color} size="sm" />
                {CLASSIFICATION_LABELS[classification]}
              </span>
              {isGoal ? <StatusBadge goalStatus={goalStatus!} /> : <StatusBadge status={budgetStatus!} />}
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--muted)]">{isGoal ? `Meta ${suffix}` : `Orçado ${suffix}`}</p>
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
              <ProgressRing pct={pct} color={ringColor} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
