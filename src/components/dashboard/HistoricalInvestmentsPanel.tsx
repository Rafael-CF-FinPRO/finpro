import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistory } from "@/lib/budget";

/** "Investimentos" — Meta, Realizado and % da Receita investida per
 * month, plus the period total. Purely informational (no status/goal
 * badge here — that live judgment belongs to the monthly view; this is
 * the historical record of it). */
export function HistoricalInvestmentsPanel({ history }: { history: BudgetHistory }) {
  const { months, totals } = history;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-stone-700">Investimentos</p>
        <p className="text-sm text-stone-900">
          Total investido no período:{" "}
          <span className="font-semibold" style={{ color: CLASSIFICATION_COLORS.INVESTIMENTOS }}>
            {formatCentsToBRL(totals.investimentosCents)}
          </span>
        </p>
      </div>

      {months.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Nenhum mês no período selecionado.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-[var(--surface-border)] text-left text-xs text-[var(--muted)]">
                <th className="pb-2 font-medium">Mês</th>
                <th className="pb-2 font-medium">Meta</th>
                <th className="pb-2 font-medium">Realizado</th>
                <th className="pb-2 font-medium">% da Receita</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const pctReceita = m.receitaCents > 0 ? Math.round((m.investimentosCents / m.receitaCents) * 1000) / 10 : null;
                return (
                  <tr key={m.monthKey} className="border-b border-[var(--surface-border)] last:border-0">
                    <td className="py-2 pr-2 font-medium text-stone-900">{m.shortLabel}</td>
                    <td className="py-2 pr-2 text-stone-900">{formatCentsToBRL(m.investimentosMetaCents)}</td>
                    <td className="py-2 pr-2 text-stone-900">{formatCentsToBRL(m.investimentosCents)}</td>
                    <td className="py-2 text-stone-900">
                      {pctReceita === null ? "—" : `${pctReceita.toLocaleString("pt-BR")}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
