import { formatCentsToBRL } from "@/lib/money";
import { CompositionDonut } from "./CompositionDonut";
import type { SuccessionPlanning } from "@/lib/patrimonio";

// One color per sucessório element — at most 5 ever appear (Seguro de
// Vida, VGBL, PGBL, Holding, Offshore), so a small fixed palette is
// simpler than a dedicated color-per-element map like the cadastro
// categories have.
const SUCCESSION_PALETTE = ["var(--chart-saldo)", "var(--success)", "var(--warning)", "var(--patrimonio-intangivel)", "var(--patrimonio-colecionavel)"];

function ComparisonBar({ label, valueCents, maxCents, color }: { label: string; valueCents: number; maxCents: number; color: string }) {
  const pct = maxCents > 0 ? Math.min((valueCents / maxCents) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{label}</span>
        <span className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(valueCents)}</span>
      </div>
      <div className="mt-1 h-3 rounded-full bg-[var(--control-track)]">
        <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/** "Planejamento Sucessório" (spec sections 11-14) — a comparison
 * between the current value of the 5 sucessório-relevant proteções and
 * a 20%-of-ativos target, plus how that current value splits across
 * those elements. `planning` already carries every number pre-computed
 * (src/lib/patrimonio.ts's computeSuccessionPlanning) — this component
 * only renders it. */
export function SuccessionPlanningSection({ planning }: { planning: SuccessionPlanning }) {
  const { totalAssetsCents, metaCents, currentCents, gapCents, pctCoverage, byElement } = planning;
  const maxCents = Math.max(metaCents, currentCents, 1);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card p-4 sm:p-5">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Planejamento Sucessório</p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Soma de Seguro de Vida, Previdência VGBL, Previdência PGBL, Holding e Offshore, comparada a uma meta de 20% dos Ativos
          Totais.
        </p>

        <div className="mt-4 space-y-3">
          <ComparisonBar label="Proteção Sucessória Atual" valueCents={currentCents} maxCents={maxCents} color="var(--chart-saldo)" />
          <ComparisonBar label="Meta Sucessória (20% dos Ativos)" valueCents={metaCents} maxCents={maxCents} color="var(--text-faint)" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--surface-border)] pt-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--muted)]">Ativos Totais</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCentsToBRL(totalAssetsCents)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Meta (20%)</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCentsToBRL(metaCents)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Complementação necessária</p>
            <p className="text-sm font-semibold text-[var(--warning)]">{formatCentsToBRL(gapCents)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">% Atingido</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {pctCoverage === null ? "—" : `${Math.round(pctCoverage)}%`}
            </p>
          </div>
        </div>
      </div>

      <CompositionDonut
        title="Composição da Proteção Sucessória"
        data={byElement}
        colorFor={(_, i) => SUCCESSION_PALETTE[i % SUCCESSION_PALETTE.length]}
        emptyMessage="Nenhum valor cadastrado nos elementos sucessórios ainda."
      />
    </div>
  );
}
