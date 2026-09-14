"use client";

import { useState } from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";
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
import {
  PATRIMONIO_ASSET_GROUP_META,
  PATRIMONIO_LIABILITY_GROUP_META,
  PATRIMONIO_PROTECTION_GROUP_META,
} from "@/lib/patrimonio-group-meta";
import type { PatrimonioAsset, PatrimonioLiability, PatrimonioProtection } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";
import type { CategoryComposition, PatrimonioMonthPoint, PatrimonioSnapshotRow, PatrimonioTotals } from "@/lib/patrimonio";

const ASSET_CATEGORIES: PatrimonioAssetCategory[] = ["FINANCEIRO", "BEM_MOVEL", "BEM_IMOVEL", "INTANGIVEL", "COLECIONAVEL"];
const LIABILITY_CATEGORIES: PatrimonioLiabilityCategory[] = ["EMPRESTIMO_DIVIDA", "FINANCIAMENTO", "CONSORCIO", "OUTRO"];
const PROTECTION_KEY = "PROTECAO";
const ProtectionIcon = PATRIMONIO_PROTECTION_GROUP_META.icon;
/** Every inner cadastro group's key, in the same order they render —
 * what "Expandir/Recolher todas" toggles as one batch. */
const ALL_GROUP_KEYS: string[] = [...ASSET_CATEGORIES, ...LIABILITY_CATEGORIES, PROTECTION_KEY];

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
 * groups are expanded, driven either individually per section or all at
 * once via the header's "Expandir/Recolher todas" control) and composes
 * the smaller pieces. */
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
  // Absent from this map == closed, same "starts closed" default every
  // group already had before the global control existed.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  function isOpen(key: string) {
    return expandedGroups[key] ?? false;
  }
  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  }
  function expandAll() {
    setExpandedGroups(Object.fromEntries(ALL_GROUP_KEYS.map((key) => [key, true])));
  }
  function collapseAll() {
    setExpandedGroups(Object.fromEntries(ALL_GROUP_KEYS.map((key) => [key, false])));
  }

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
        headerActions={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
            >
              <ChevronsDown size={14} /> Expandir todas
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
            >
              <ChevronsUp size={14} /> Recolher todas
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Ativos</p>
          {ASSET_CATEGORIES.map((category) => {
            const items = assets.filter((a) => a.category === category);
            const meta = PATRIMONIO_ASSET_GROUP_META[category];
            const Icon = meta.icon;
            return (
              <CollapsibleSection
                key={category}
                title={PATRIMONIO_ASSET_CATEGORY_LABELS[category]}
                subtitle={meta.subtitle}
                icon={<Icon size={18} className="shrink-0 text-[var(--muted)]" />}
                open={isOpen(category)}
                onToggle={() => toggleGroup(category)}
                badge={<CountBadge count={items.filter((a) => a.isActive).length} />}
              >
                <AssetCategoryTable category={category} assets={items} />
              </CollapsibleSection>
            );
          })}

          <p className="pt-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Passivos</p>
          {LIABILITY_CATEGORIES.map((category) => {
            const items = liabilities.filter((l) => l.category === category);
            const meta = PATRIMONIO_LIABILITY_GROUP_META[category];
            const Icon = meta.icon;
            return (
              <CollapsibleSection
                key={category}
                title={PATRIMONIO_LIABILITY_CATEGORY_LABELS[category]}
                subtitle={meta.subtitle}
                icon={<Icon size={18} className="shrink-0 text-[var(--muted)]" />}
                open={isOpen(category)}
                onToggle={() => toggleGroup(category)}
                badge={<CountBadge count={items.filter((l) => l.isActive).length} />}
              >
                <LiabilityCategoryTable category={category} liabilities={items} assets={assets.filter((a) => a.isActive)} />
              </CollapsibleSection>
            );
          })}

          <p className="pt-2 text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Proteção</p>
          <CollapsibleSection
            title="Proteção Patrimonial e Planejamento Sucessório"
            subtitle={PATRIMONIO_PROTECTION_GROUP_META.subtitle}
            icon={<ProtectionIcon size={18} className="shrink-0 text-[var(--muted)]" />}
            open={isOpen(PROTECTION_KEY)}
            onToggle={() => toggleGroup(PROTECTION_KEY)}
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
