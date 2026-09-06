import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistory } from "@/lib/budget";

/** "Resumo Histórico" — the period's 4 headline averages, same card
 * style and same Receita/Despesas/Investimentos/Saldo split as the
 * monthly view's MonthSummaryStrip, just averaged across the selected
 * range instead of a single month's figures. */
export function HistoricalSummaryStrip({ history }: { history: BudgetHistory }) {
  const { averages } = history;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Receita Média</p>
        <p className="mt-1 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(averages.receitaCents)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Despesas Médias</p>
        <p className="mt-1 text-xl font-semibold text-[var(--danger)]">
          {formatCentsToBRL(averages.despesasCents)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Investimentos Médios</p>
        <p className="mt-1 text-xl font-semibold" style={{ color: CLASSIFICATION_COLORS.INVESTIMENTOS }}>
          {formatCentsToBRL(averages.investimentosCents)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Saldo Médio</p>
        <p
          className={`mt-1 text-xl font-semibold ${
            averages.saldoCents < 0 ? "text-[var(--danger)]" : "text-stone-900"
          }`}
        >
          {formatCentsToBRL(averages.saldoCents)}
        </p>
      </div>
    </div>
  );
}
