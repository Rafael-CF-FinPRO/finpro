import { Landmark, TrendingDown, Scale } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { IconBadge } from "@/components/orcamento/IconBadge";

/** The 3 headline numbers for the current month — same card shape as
 * MonthSummaryStrip (Dashboard). "Patrimônio Bruto" from the spec is
 * exactly Ativos Totais (nothing subtracted yet), so it isn't a 4th
 * card — just called out in the caption under Patrimônio Líquido,
 * matching the plan's decision to keep the indicator row to 3 cards. */
export function PatrimonioIndicatorCards({
  totalAssetsCents,
  totalLiabilitiesCents,
  netWorthCents,
}: {
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
    </div>
  );
}
