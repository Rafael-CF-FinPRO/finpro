import { ShieldCheck, ShieldAlert, ShieldQuestion, Percent } from "lucide-react";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { ProtectionSummary } from "@/lib/patrimonio";

/** The 4 counting-based indicators from spec section 8 — a proteção
 * only counts as "possuída" when it was also "necessária" (never an
 * unneeded one), matching ProtectionGauge/computeProtectionSummary's
 * own rule exactly. */
export function ProtectionSummaryCards({ summary }: { summary: ProtectionSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={ShieldQuestion} color="var(--muted)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Necessárias</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{summary.necessarias}</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={ShieldCheck} color="var(--success)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Possuídas</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--success)]">{summary.possuidas}</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={ShieldAlert} color="var(--danger)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Pendentes</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--danger)]">{summary.pendentes}</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Percent} color="var(--primary)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Cobertura</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
          {summary.pctCoverage === null ? "—" : `${Math.round(summary.pctCoverage)}%`}
        </p>
      </div>
    </div>
  );
}
