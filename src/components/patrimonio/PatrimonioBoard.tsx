"use client";

import { PatrimonioIndicatorCards } from "./PatrimonioIndicatorCards";
import { CollapsibleSection } from "./CollapsibleSection";
import { AssetCategoryTable } from "./AssetCategoryTable";
import { LiabilityCategoryTable } from "./LiabilityCategoryTable";
import { ProtectionTable } from "./ProtectionTable";
import { NetWorthEvolutionChart } from "./NetWorthEvolutionChart";
import { AssetCompositionDonut } from "./AssetCompositionDonut";
import { LiabilityCompositionDonut } from "./LiabilityCompositionDonut";
import { MonthlyConfirmationPanel } from "./MonthlyConfirmationPanel";
import { PATRIMONIO_ASSET_CATEGORY_LABELS, PATRIMONIO_LIABILITY_CATEGORY_LABELS } from "@/lib/patrimonio-colors";
import type { PatrimonioAsset, PatrimonioLiability, PatrimonioProtection } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";
import type { CategoryComposition, PatrimonioMonthPoint, PatrimonioSnapshotRow, PatrimonioTotals } from "@/lib/patrimonio";

const ASSET_CATEGORIES: PatrimonioAssetCategory[] = ["FINANCEIRO", "BEM_MOVEL", "BEM_IMOVEL", "INTANGIVEL", "COLECIONAVEL"];
const LIABILITY_CATEGORIES: PatrimonioLiabilityCategory[] = ["EMPRESTIMO_DIVIDA", "FINANCIAMENTO", "CONSORCIO", "OUTRO"];

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--text-tertiary)]">
      {count}
    </span>
  );
}

/** The big client orchestrator — mirrors BudgetBoard.tsx: page.tsx does
 * all the auth + data-fetching + calculation (src/lib/patrimonio.ts),
 * this component just owns local UI state (which of the ~10 cadastro
 * groups are expanded is handled inside each CollapsibleSection itself,
 * so this component doesn't even need to track it) and composes the
 * smaller pieces. */
export function PatrimonioBoard({
  assets,
  liabilities,
  protections,
  totals,
  series,
  assetsByCategory,
  assetsByUsage,
  assetsByLocation,
  liabilitiesByCategory,
  confirmMonthKey,
  snapshotRows,
}: {
  assets: PatrimonioAsset[];
  liabilities: PatrimonioLiability[];
  protections: PatrimonioProtection[];
  totals: PatrimonioTotals;
  series: PatrimonioMonthPoint[];
  assetsByCategory: CategoryComposition[];
  assetsByUsage: CategoryComposition[];
  assetsByLocation: CategoryComposition[];
  liabilitiesByCategory: CategoryComposition[];
  confirmMonthKey: string;
  snapshotRows: PatrimonioSnapshotRow[];
}) {
  return (
    <div className="space-y-6">
      <PatrimonioIndicatorCards
        totalAssetsCents={totals.totalAssetsCents}
        totalLiabilitiesCents={totals.totalLiabilitiesCents}
        netWorthCents={totals.netWorthCents}
      />

      <CollapsibleSection
        title="Cadastros Gerais"
        subtitle="Bens, dívidas e proteção patrimonial — cadastre uma vez, acompanhe todo mês."
        defaultOpen
      >
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Ativos</p>
          {ASSET_CATEGORIES.map((category) => {
            const items = assets.filter((a) => a.category === category);
            return (
              <CollapsibleSection
                key={category}
                title={PATRIMONIO_ASSET_CATEGORY_LABELS[category]}
                badge={<CountBadge count={items.filter((a) => a.isActive).length} />}
              >
                <AssetCategoryTable category={category} assets={items} />
              </CollapsibleSection>
            );
          })}

          <p className="pt-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Passivos</p>
          {LIABILITY_CATEGORIES.map((category) => {
            const items = liabilities.filter((l) => l.category === category);
            return (
              <CollapsibleSection
                key={category}
                title={PATRIMONIO_LIABILITY_CATEGORY_LABELS[category]}
                badge={<CountBadge count={items.filter((l) => l.isActive).length} />}
              >
                <LiabilityCategoryTable category={category} liabilities={items} assets={assets.filter((a) => a.isActive)} />
              </CollapsibleSection>
            );
          })}

          <p className="pt-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Proteção</p>
          <CollapsibleSection
            title="Proteção Patrimonial e Planejamento Sucessório"
            badge={<CountBadge count={protections.filter((p) => p.isActive).length} />}
          >
            <ProtectionTable protections={protections} />
          </CollapsibleSection>
        </div>
      </CollapsibleSection>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Visão Patrimonial</h2>

        <NetWorthEvolutionChart points={series} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AssetCompositionDonut byCategory={assetsByCategory} byUsage={assetsByUsage} byLocation={assetsByLocation} />
          <LiabilityCompositionDonut byCategory={liabilitiesByCategory} />
        </div>

        <MonthlyConfirmationPanel monthKey={confirmMonthKey} rows={snapshotRows} />
      </div>
    </div>
  );
}
