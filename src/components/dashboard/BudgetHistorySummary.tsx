import { formatCentsToBRL } from "@/lib/money";
import type { BudgetHealth } from "@/lib/budget-calc";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
import { SaldoGauge } from "@/components/orcamento/SaldoGauge";
import type { BudgetHistory } from "@/lib/budget";
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

/** Same visual language as BudgetSummaryDashboard (the monthly view),
 * but for totals aggregated across a date range instead of one month —
 * each card adds "Realizado médio/mês" since "Orçado" here is a sum
 * across several months, not a single figure to compare a lançamento
 * against. */
export function BudgetHistorySummary({ history }: { history: BudgetHistory }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {history.classifications.map((cls) => {
          const color = CLASSIFICATION_COLORS[cls.classification as NonReceita];
          const isOverBudget = cls.pctGasto !== null && cls.pctGasto > 100;
          const barWidth = cls.pctGasto === null ? 0 : Math.min(cls.pctGasto, 100);
          const health = HEALTH_META[cls.health];

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
              <p className="mt-2 text-sm text-[var(--muted)]">Orçado no período</p>
              <p className="text-lg font-semibold text-stone-900">
                {formatCentsToBRL(cls.budgetedCents)}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">Realizado no período</p>
              <p className="text-lg font-semibold text-stone-900">
                {formatCentsToBRL(cls.realizedCents)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Média de {formatCentsToBRL(cls.avgRealizedCents)}/mês
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
                  {cls.pctGasto === null ? "— gasto" : `${cls.pctGasto.toLocaleString("pt-BR")}% gasto`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium text-stone-700">Saldo / Resultado do período</p>
        <div className="mt-2">
          <SaldoGauge incomeCents={history.totals.incomeCents} realizedCents={history.totals.realizedCents} />
        </div>
      </div>
    </div>
  );
}
