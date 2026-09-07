import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistory } from "@/lib/budget";

/** "Investimentos" — Meta, Realizado and % da Receita investida per
 * month, plus the period total. Purely informational (no status/goal
 * badge here — that live judgment belongs to the monthly view; this is
 * the historical record of it). Deliberately compact — a small table,
 * capped in height with its own scroll for long periods — so this panel
 * doesn't compete for space with Top 10 Categorias in the same grid row
 * (section 5 of the Visão Histórica revision: shrink this one, grow
 * that one). */
export function HistoricalInvestmentsPanel({ history }: { history: BudgetHistory }) {
  const { months, totals } = history;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Investimentos</p>
        <p className="text-sm text-[var(--text-primary)]">
          Total no período:{" "}
          <span className="font-semibold" style={{ color: CLASSIFICATION_COLORS.INVESTIMENTOS }}>
            {formatCentsToBRL(totals.investimentosCents)}
          </span>
        </p>
      </div>

      {months.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Nenhum mês no período selecionado.</p>
      ) : (
        <div className="mt-3 max-h-[200px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[380px] text-sm">
            <thead>
              <tr className="sticky top-0 border-b border-[var(--surface-border)] bg-[var(--surface)] text-left text-xs text-[var(--muted)]">
                <th className="pb-1.5 font-medium">Mês</th>
                <th className="pb-1.5 font-medium">Meta</th>
                <th className="pb-1.5 font-medium">Realizado</th>
                <th className="pb-1.5 font-medium">% Receita</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const pctReceita = m.receitaCents > 0 ? Math.round((m.investimentosCents / m.receitaCents) * 1000) / 10 : null;
                return (
                  <tr key={m.monthKey} className="border-b border-[var(--surface-border)] last:border-0">
                    <td className="py-1.5 pr-2 font-medium text-[var(--text-primary)]">{m.shortLabel}</td>
                    <td className="py-1.5 pr-2 text-[var(--text-primary)]">{formatCentsToBRL(m.investimentosMetaCents)}</td>
                    <td className="py-1.5 pr-2 text-[var(--text-primary)]">{formatCentsToBRL(m.investimentosCents)}</td>
                    <td className="py-1.5 text-[var(--text-primary)]">
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
