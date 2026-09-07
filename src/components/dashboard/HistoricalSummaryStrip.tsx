import { Wallet, TrendingDown, Scale } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { BudgetHistory } from "@/lib/budget";

/** "Resumo Histórico" — the period's 4 headline figures, same card
 * style and same Receita/Despesas/Investimentos/Saldo split as the
 * monthly view's MonthSummaryStrip. Toggled by the parent
 * HistoricalOverviewCards between the period's monthly average
 * (history.averages) and its raw total (history.totals) — both already
 * computed server-side, so this only ever picks which one to display. */
export function HistoricalSummaryStrip({
  history,
  view,
}: {
  history: BudgetHistory;
  view: "media" | "total";
}) {
  const values = view === "total" ? history.totals : history.averages;
  const suffix = view === "total" ? "Total" : "Média";
  const period = view === "total" ? "no período" : "mensal no período";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Wallet} color="var(--success)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Receita {suffix}</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(values.receitaCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Total recebido {period}</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={TrendingDown} color="var(--danger)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Despesas {suffix === "Total" ? "Totais" : "Médias"}</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--danger)]">
          {formatCentsToBRL(values.despesasCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Total gasto {period}</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge
            icon={CLASSIFICATION_ICONS.INVESTIMENTOS}
            color={CLASSIFICATION_COLORS.INVESTIMENTOS}
            variant="soft"
            size="sm"
          />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Investimentos {suffix === "Total" ? "Totais" : "Médios"}</p>
        </div>
        <p className="mt-2 text-xl font-semibold" style={{ color: CLASSIFICATION_COLORS.INVESTIMENTOS }}>
          {formatCentsToBRL(values.investimentosCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Total investido {period}</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Scale} color="var(--primary)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Saldo {suffix}</p>
        </div>
        <p
          className={`mt-2 text-xl font-semibold ${
            values.saldoCents < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
          }`}
        >
          {formatCentsToBRL(values.saldoCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Saldo {period}</p>
      </div>
    </div>
  );
}
