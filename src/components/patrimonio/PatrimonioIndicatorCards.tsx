import { Landmark, TrendingDown, Scale, Percent } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { DebtRatio } from "@/lib/patrimonio";

/** Above 60% endividamento reads as a real risk signal, 30-60% as
 * worth watching, below 30% as comfortable — the same 3-tier
 * traffic-light convention used everywhere else in the app (StatusBadge,
 * the compliance gauge on Dashboard), just with different cutoffs since
 * this is a debt ratio, not a budget-compliance percentage. */
function debtRatioColor(pct: number | null): string {
  if (pct === null) return "var(--muted)";
  if (pct >= 60) return "var(--danger)";
  if (pct >= 30) return "var(--warning)";
  return "var(--success)";
}

/** The 4 headline numbers for the current month — same card shape as
 * MonthSummaryStrip (Dashboard). "Patrimônio Bruto" from the spec is
 * exactly Ativos Totais (nothing subtracted yet), so it isn't its own
 * card — just called out in the caption under Patrimônio Líquido.
 * Nível de Endividamento (spec section 6) joins the other 3 as a plain
 * current-moment indicator, no historical chart. */
export function PatrimonioIndicatorCards({
  totalAssetsCents,
  totalLiabilitiesCents,
  netWorthCents,
  debtRatio,
}: {
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
  debtRatio: DebtRatio;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Landmark} color="var(--success)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Ativos Totais</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(totalAssetsCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Patrimônio Bruto — soma de todos os bens ativos</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={TrendingDown} color="var(--danger)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Passivos Totais</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--danger)]">
          {formatCentsToBRL(totalLiabilitiesCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Soma de todas as dívidas ativas</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Scale} color="var(--primary)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Patrimônio Líquido</p>
        </div>
        <p
          className={`mt-2 text-xl font-semibold ${
            netWorthCents < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
          }`}
        >
          {formatCentsToBRL(netWorthCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Ativos Totais − Passivos Totais</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Percent} color={debtRatioColor(debtRatio.pct)} variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Nível de Endividamento</p>
        </div>
        <p className="mt-2 text-xl font-semibold" style={{ color: debtRatioColor(debtRatio.pct) }}>
          {debtRatio.pct === null ? "Não calculado" : `${debtRatio.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Passivos Totais ÷ Ativos Totais</p>
      </div>
    </div>
  );
}
