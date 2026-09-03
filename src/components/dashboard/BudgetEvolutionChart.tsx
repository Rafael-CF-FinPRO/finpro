import { formatCentsToBRL } from "@/lib/money";
import type { BudgetHistoryMonth } from "@/lib/budget";

const CHART_HEIGHT = 160;

/** Month-by-month Orçado × Realizado trend for the selected historical
 * period. Plain flex/CSS bars (heights as %) rather than SVG — simpler
 * to keep correct than hand-rolled arc/path math for a chart that just
 * needs two proportional bars per month. */
export function BudgetEvolutionChart({ months }: { months: BudgetHistoryMonth[] }) {
  if (months.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum mês no período selecionado.
      </div>
    );
  }

  const max = Math.max(1, ...months.flatMap((m) => [m.budgetedCents, m.realizedCents]));

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-stone-700">Evolução mensal — Orçado × Realizado</p>
      <div className="mt-4 overflow-x-auto">
        <div className="flex min-w-max items-end gap-5 px-1" style={{ height: CHART_HEIGHT }}>
          {months.map((m) => {
            const budgetedHeight = Math.round((m.budgetedCents / max) * 100);
            const realizedHeight = Math.round((m.realizedCents / max) * 100);
            const isOver = m.budgetedCents > 0 && m.realizedCents > m.budgetedCents;
            return (
              <div key={m.monthKey} className="flex h-full flex-col items-center justify-end gap-1">
                <div className="flex h-full items-end gap-1.5">
                  <div
                    className="w-3.5 rounded-t bg-stone-200"
                    style={{ height: `${budgetedHeight}%` }}
                    title={`Orçado: ${formatCentsToBRL(m.budgetedCents)}`}
                  />
                  <div
                    className={`w-3.5 rounded-t ${isOver ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`}
                    style={{ height: `${realizedHeight}%` }}
                    title={`Realizado: ${formatCentsToBRL(m.realizedCents)}`}
                  />
                </div>
                <p className="whitespace-nowrap text-[11px] text-[var(--muted)]">{m.shortLabel}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-stone-200" /> Orçado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--primary)]" /> Realizado
        </span>
      </div>
    </div>
  );
}
