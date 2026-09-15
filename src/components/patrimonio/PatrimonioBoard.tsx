"use client";

import { useState } from "react";
import { ChevronsDown, ChevronsUp, Landmark, TrendingDown } from "lucide-react";
import { PatrimonioIndicatorCards } from "./PatrimonioIndicatorCards";
import { CollapsibleSection } from "./CollapsibleSection";
import { AssetCategoryTable } from "./AssetCategoryTable";
import { LiabilityCategoryTable } from "./LiabilityCategoryTable";
import { ProtectionTable } from "./ProtectionTable";
import { NetWorthEvolutionChart } from "./NetWorthEvolutionChart";
import { CompositionDonut } from "./CompositionDonut";
import { DebtRatioGauge } from "./DebtRatioGauge";
import { ProtectionSummaryCards } from "./ProtectionSummaryCards";
import { ProtectionGauge } from "./ProtectionGauge";
import { ProtectionDetailBreakdown } from "./ProtectionDetailBreakdown";
import { SuccessionPlanningSection } from "./SuccessionPlanningSection";
import {
  PATRIMONIO_ASSET_CATEGORY_LABELS,
  PATRIMONIO_LIABILITY_CATEGORY_LABELS,
  PATRIMONIO_ASSET_CATEGORY_COLORS,
  PATRIMONIO_LIABILITY_CATEGORY_COLORS,
} from "@/lib/patrimonio-colors";
import {
  PATRIMONIO_ASSET_GROUP_META,
  PATRIMONIO_LIABILITY_GROUP_META,
  PATRIMONIO_PROTECTION_GROUP_META,
} from "@/lib/patrimonio-group-meta";
import type { PatrimonioAsset, PatrimonioLiability, PatrimonioProtection } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";
import type {
  AssetAppreciationRate,
  CapitalReturn,
  CategoryComposition,
  DebtRatio,
  PatrimonioMonthPoint,
  PatrimonioTotals,
  ProtectionDetailRow,
  ProtectionSummary,
  SuccessionPlanning,
} from "@/lib/patrimonio";

// Tipo/Localização only ever have 2 real values + "Não informado" — a
// small fixed palette is enough, unlike Categoria which has its own
// dedicated color per category (patrimonio-colors.ts).
const FALLBACK_PALETTE = ["var(--primary)", "var(--success)", "var(--text-faint)"];
const LIQUIDITY_COLORS: Record<string, string> = {
  ALTA: "var(--success)",
  MEDIA: "var(--warning)",
  BAIXA: "var(--danger)",
  NAO_INFORMADO: "var(--text-faint)",
};

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
  assetsByLiquidity,
  liabilitiesByCategory,
  debtRatio,
  protectionSummary,
  protectionDetailRows,
  successionPlanning,
  assetAppreciationById,
  capitalReturnById,
}: {
  assets: PatrimonioAsset[];
  liabilities: PatrimonioLiability[];
  protections: PatrimonioProtection[];
  totals: PatrimonioTotals;
  series: PatrimonioMonthPoint[];
  assetsByCategory: CategoryComposition[];
  assetsByUsage: CategoryComposition[];
  assetsByLocation: CategoryComposition[];
  assetsByLiquidity: CategoryComposition[];
  liabilitiesByCategory: CategoryComposition[];
  debtRatio: DebtRatio;
  protectionSummary: ProtectionSummary;
  protectionDetailRows: ProtectionDetailRow[];
  successionPlanning: SuccessionPlanning;
  assetAppreciationById: Record<string, AssetAppreciationRate>;
  capitalReturnById: Record<string, CapitalReturn>;
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
        debtRatio={debtRatio}
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
          <p className="flex items-center gap-1.5 text-sm font-bold tracking-wide uppercase" style={{ color: "var(--success)" }}>
            <Landmark size={15} /> Ativos
          </p>
          {ASSET_CATEGORIES.map((category) => {
            const items = assets.filter((a) => a.category === category);
            const meta = PATRIMONIO_ASSET_GROUP_META[category];
            const Icon = meta.icon;
            return (
              <CollapsibleSection
                key={category}
                title={PATRIMONIO_ASSET_CATEGORY_LABELS[category]}
                tooltip={meta.subtitle}
                icon={<Icon size={18} className="shrink-0 text-[var(--muted)]" />}
                open={isOpen(category)}
                onToggle={() => toggleGroup(category)}
                badge={<CountBadge count={items.filter((a) => a.isActive).length} />}
              >
                <AssetCategoryTable
                  category={category}
                  assets={items}
                  assetAppreciationById={assetAppreciationById}
                  capitalReturnById={capitalReturnById}
                />
              </CollapsibleSection>
            );
          })}

          <p
            className="flex items-center gap-1.5 pt-2 text-sm font-bold tracking-wide uppercase"
            style={{ color: "var(--danger)" }}
          >
            <TrendingDown size={15} /> Passivos
          </p>
          {LIABILITY_CATEGORIES.map((category) => {
            const items = liabilities.filter((l) => l.category === category);
            const meta = PATRIMONIO_LIABILITY_GROUP_META[category];
            const Icon = meta.icon;
            return (
              <CollapsibleSection
                key={category}
                title={PATRIMONIO_LIABILITY_CATEGORY_LABELS[category]}
                tooltip={meta.subtitle}
                icon={<Icon size={18} className="shrink-0 text-[var(--muted)]" />}
                open={isOpen(category)}
                onToggle={() => toggleGroup(category)}
                badge={<CountBadge count={items.filter((l) => l.isActive).length} />}
              >
                <LiabilityCategoryTable category={category} liabilities={items} assets={assets.filter((a) => a.isActive)} />
              </CollapsibleSection>
            );
          })}

          <p
            className="flex items-center gap-1.5 pt-2 text-sm font-bold tracking-wide uppercase"
            style={{ color: "var(--chart-saldo)" }}
          >
            <ProtectionIcon size={15} /> Proteção
          </p>
          <CollapsibleSection
            title="Proteção Patrimonial e Planejamento Sucessório"
            tooltip={PATRIMONIO_PROTECTION_GROUP_META.subtitle}
            icon={<ProtectionIcon size={18} className="shrink-0 text-[var(--muted)]" />}
            open={isOpen(PROTECTION_KEY)}
            onToggle={() => toggleGroup(PROTECTION_KEY)}
            badge={<CountBadge count={protections.filter((p) => p.isActive).length} />}
          >
            <ProtectionTable protections={protections} />
          </CollapsibleSection>
        </div>
      </CollapsibleSection>

      <div className="space-y-8">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Visão Patrimonial</h2>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">Evolução Patrimonial</h3>
          <NetWorthEvolutionChart points={series} />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">Dados dos Ativos</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CompositionDonut
              title="Por Categoria"
              data={assetsByCategory}
              colorFor={(cat) => PATRIMONIO_ASSET_CATEGORY_COLORS[cat as PatrimonioAssetCategory]}
              emptyMessage="Nenhum ativo cadastrado ainda."
            />
            <CompositionDonut
              title="Por Tipo / Usabilidade"
              data={assetsByUsage}
              colorFor={(_, i) => FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]}
              emptyMessage="Nenhum ativo cadastrado ainda."
            />
            <CompositionDonut
              title="Por Localização"
              data={assetsByLocation}
              colorFor={(_, i) => FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]}
              emptyMessage="Nenhum ativo cadastrado ainda."
            />
            <CompositionDonut
              title="Por Nível de Liquidez"
              data={assetsByLiquidity}
              colorFor={(cat) => LIQUIDITY_COLORS[cat] ?? "var(--text-faint)"}
              emptyMessage="Nenhum ativo cadastrado ainda."
            />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">Dados dos Passivos</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CompositionDonut
              title="Por Categoria"
              data={liabilitiesByCategory}
              colorFor={(cat) => PATRIMONIO_LIABILITY_CATEGORY_COLORS[cat as PatrimonioLiabilityCategory]}
              emptyMessage="Nenhum passivo cadastrado ainda."
            />
            <DebtRatioGauge debtRatio={debtRatio} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">Proteção Patrimonial</h3>
          <ProtectionSummaryCards summary={protectionSummary} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card flex flex-col p-4 sm:p-5">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Nível de Proteção</p>
              <div className="mt-2 flex flex-1 items-center justify-center">
                <ProtectionGauge pct={protectionSummary.pctCoverage} />
              </div>
            </div>
            <ProtectionDetailBreakdown rows={protectionDetailRows} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--text-tertiary)] uppercase">Planejamento Sucessório</h3>
          <SuccessionPlanningSection planning={successionPlanning} />
        </div>
      </div>
    </div>
  );
}
