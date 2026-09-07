import { Wallet, TrendingDown, Scale } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
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
        <div className="flex items-center gap-2">
          <IconBadge icon={Wallet} color="var(--success)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Receita Média</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(averages.receitaCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Média mensal recebida no período</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={TrendingDown} color="var(--danger)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Despesas Médias</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--danger)]">
          {formatCentsToBRL(averages.despesasCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Média mensal gasta no período</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge
            icon={CLASSIFICATION_ICONS.INVESTIMENTOS}
            color={CLASSIFICATION_COLORS.INVESTIMENTOS}
            variant="soft"
            size="sm"
          />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Investimentos Médios</p>
        </div>
        <p className="mt-2 text-xl font-semibold" style={{ color: CLASSIFICATION_COLORS.INVESTIMENTOS }}>
          {formatCentsToBRL(averages.investimentosCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Média mensal investida no período</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Scale} color="var(--primary)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Saldo Médio</p>
        </div>
        <p
          className={`mt-2 text-xl font-semibold ${
            averages.saldoCents < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
          }`}
        >
          {formatCentsToBRL(averages.saldoCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Saldo médio mensal no período</p>
      </div>
    </div>
  );
}
