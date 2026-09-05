import { formatCentsToBRL } from "@/lib/money";
import {
  computeBudgetPct,
  computeBudgetHealth,
  computeGoalStatus,
  isGoalClassification,
  type BudgetHealth,
} from "@/lib/budget-calc";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "./IconBadge";
import { SaldoGauge } from "./SaldoGauge";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

const HEALTH_META: Record<BudgetHealth, { label: string; className: string }> = {
  COM_FOLGA: {
    label: "Com folga",
    className: "bg-[var(--success-bg)] text-[var(--success)]",
  },
  EM_ATENCAO: {
    label: "Em atenção",
    className: "bg-[var(--warning-bg)] text-[var(--warning)]",
  },
  ESTOURADA: {
    label: "Estourada",
    className: "bg-[var(--danger-bg)] text-[var(--danger)]",
  },
};

// Investimentos is a goal, not a spend with a ceiling — see
// isGoalClassification in src/lib/budget-calc.ts. Reusing HEALTH_META's
// wording here would misread as a warning even recolored ("Estourada"
// always sounds bad), so goal classifications get their own labels.
const GOAL_HEALTH_META = {
  EM_PROGRESSO: { label: "Em progresso", className: "bg-stone-100 text-stone-600" },
  QUASE_LA: { label: "Quase lá", className: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  META_ATINGIDA: { label: "Meta atingida", className: "bg-[var(--success-bg)] text-[var(--success)]" },
};

export function BudgetSummaryDashboard({
  monthlyIncomeCents,
  classifications,
}: {
  monthlyIncomeCents: number;
  classifications: ClassificationBudgetRow[];
}) {
  const totalRealizedCents = classifications.reduce((sum, c) => sum + c.realizedCents, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {classifications.map((cls) => {
          const color = CLASSIFICATION_COLORS[cls.classification as NonReceita];
          const pctGasto = computeBudgetPct(cls.realizedCents, cls.budgetedCents);
          const isGoal = isGoalClassification(cls.classification);
          const isOverBudget = !isGoal && pctGasto !== null && pctGasto > 100;
          const barWidth = pctGasto === null ? 0 : Math.min(pctGasto, 100);
          const health = isGoal
            ? GOAL_HEALTH_META[computeGoalStatus(cls.realizedCents, cls.budgetedCents)]
            : HEALTH_META[computeBudgetHealth(cls.realizedCents, cls.budgetedCents)];

          return (
            <div key={cls.classification} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <IconBadge
                    icon={CLASSIFICATION_ICONS[cls.classification as NonReceita]}
                    color={color}
                    size="sm"
                  />
                  <p className="text-sm font-bold text-stone-900">
                    {CLASSIFICATION_LABELS[cls.classification]}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${health.className}`}
                >
                  {health.label}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{isGoal ? "Meta" : "Orçado"}</p>
              <p className="text-lg font-semibold text-stone-900">
                {formatCentsToBRL(cls.budgetedCents)}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{isGoal ? "Investido" : "Realizado"}</p>
              <p className="text-lg font-semibold text-stone-900">
                {formatCentsToBRL(cls.realizedCents)}
              </p>

              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: isOverBudget ? "var(--danger)" : color,
                    }}
                  />
                </div>
                <p
                  className={`mt-1 text-xs font-medium ${
                    isOverBudget ? "text-[var(--danger)]" : "text-[var(--muted)]"
                  }`}
                >
                  {pctGasto === null
                    ? isGoal
                      ? "— da meta"
                      : "— gasto"
                    : isGoal
                      ? `${pctGasto.toLocaleString("pt-BR")}% da meta`
                      : `${pctGasto.toLocaleString("pt-BR")}% gasto`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium text-stone-700">Saldo / Resultado</p>
        <div className="mt-2">
          <SaldoGauge incomeCents={monthlyIncomeCents} realizedCents={totalRealizedCents} />
        </div>
      </div>
    </div>
  );
}
