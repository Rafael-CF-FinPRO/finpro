import { prisma } from "@/lib/prisma";
import { shiftMonthKey } from "@/lib/dates";
import {
  PATRIMONIO_ASSET_CATEGORY_LABELS,
  PATRIMONIO_LIABILITY_CATEGORY_LABELS,
} from "@/lib/patrimonio-colors";
import type {
  PatrimonioAsset,
  PatrimonioLiability,
  PatrimonioProtection,
  PatrimonioMonthlyConfirmation,
  PatrimonioValueChange,
} from "@/generated/prisma/client";
import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

/** Everything this module needs about one user, fetched once per page
 * load — every computation below is pure/in-memory from this, so
 * rendering the totals, the historical series, and the compositions
 * never costs more than this single round trip. */
export async function getPatrimonioData(userId: string) {
  const [assets, liabilities, protections, confirmations, valueChanges] = await Promise.all([
    prisma.patrimonioAsset.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.patrimonioLiability.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.patrimonioProtection.findMany({ where: { userId }, orderBy: { order: "asc" } }),
    prisma.patrimonioMonthlyConfirmation.findMany({ where: { userId } }),
    // Newest first, per asset/liability — computeAssetAppreciationRate's
    // .find() below relies on this order to grab the most recent one.
    prisma.patrimonioValueChange.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);
  return { assets, liabilities, protections, confirmations, valueChanges };
}

export type PatrimonioData = Awaited<ReturnType<typeof getPatrimonioData>>;

export type ValueOrigin = "PROJETADO" | "CONFIRMADO";

function monthKeyFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToIndex(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return year * 12 + (month - 1);
}

function monthsBetween(fromKey: string, toKey: string): number {
  return monthKeyToIndex(toKey) - monthKeyToIndex(fromKey);
}

/** Compound monthly rate implied by an annual rate — never simple
 * division by 12, so a full year of projection actually lands on the
 * stated annual rate (e.g. 12% a.a. -> ~0.949% a.m., not a flat 1%). */
function monthlyRateFromAnnual(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

type ConfirmationLike = { monthKey: string; valueCents: number };

type EffectiveValueInput = {
  baseValueCents: number;
  createdAt: Date;
  /** Absent (liabilities) behaves exactly like MANUAL — there's no
   * amortization simulator in this version (see the plan), a liability
   * only ever changes value via an explicit monthly confirmation. */
  updateMethod?: "MANUAL" | "PROJECAO_AUTOMATICA";
  annualRatePct?: number | null;
};

/** The value (and its origin) of one bem/dívida for a given month.
 * Reads the sparse confirmation ledger only — never writes, never
 * overwrites an existing confirmation. Months with no confirmation
 * project forward from the most recent one (or from the cadastro's own
 * currentValueCents/createdAt if it's never been confirmed at all). */
export function effectiveValueFor(
  item: EffectiveValueInput,
  monthKey: string,
  confirmations: ConfirmationLike[]
): { valueCents: number; origin: ValueOrigin } {
  const exact = confirmations.find((c) => c.monthKey === monthKey);
  if (exact) return { valueCents: exact.valueCents, origin: "CONFIRMADO" };

  const priorConfirmations = confirmations
    .filter((c) => c.monthKey < monthKey)
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));

  const base = priorConfirmations[0]
    ? { valueCents: priorConfirmations[0].valueCents, monthKey: priorConfirmations[0].monthKey }
    : { valueCents: item.baseValueCents, monthKey: monthKeyFromDate(item.createdAt) };

  if (monthKey <= base.monthKey || item.updateMethod !== "PROJECAO_AUTOMATICA" || !item.annualRatePct) {
    return { valueCents: base.valueCents, origin: "PROJETADO" };
  }

  const months = monthsBetween(base.monthKey, monthKey);
  const monthlyRate = monthlyRateFromAnnual(item.annualRatePct);
  return { valueCents: Math.round(base.valueCents * Math.pow(1 + monthlyRate, months)), origin: "PROJETADO" };
}

function confirmationsFor(
  confirmations: PatrimonioMonthlyConfirmation[],
  kind: "asset" | "liability",
  id: string
): ConfirmationLike[] {
  return confirmations
    .filter((c) => (kind === "asset" ? c.assetId === id : c.liabilityId === id))
    .map((c) => ({ monthKey: c.monthKey, valueCents: c.valueCents }));
}

function assetEffectiveValue(asset: PatrimonioAsset, monthKey: string, confirmations: PatrimonioMonthlyConfirmation[]) {
  return effectiveValueFor(
    {
      baseValueCents: asset.currentValueCents,
      createdAt: asset.createdAt,
      updateMethod: asset.updateMethod,
      annualRatePct: asset.annualRatePct,
    },
    monthKey,
    confirmationsFor(confirmations, "asset", asset.id)
  );
}

function liabilityEffectiveValue(
  liability: PatrimonioLiability,
  monthKey: string,
  confirmations: PatrimonioMonthlyConfirmation[]
) {
  return effectiveValueFor(
    { baseValueCents: liability.currentBalanceCents, createdAt: liability.createdAt },
    monthKey,
    confirmationsFor(confirmations, "liability", liability.id)
  );
}

export type PatrimonioTotals = {
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
};

export function computeTotals(data: PatrimonioData, monthKey: string): PatrimonioTotals {
  const totalAssetsCents = data.assets
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + assetEffectiveValue(a, monthKey, data.confirmations).valueCents, 0);
  const totalLiabilitiesCents = data.liabilities
    .filter((l) => l.isActive)
    .reduce((sum, l) => sum + liabilityEffectiveValue(l, monthKey, data.confirmations).valueCents, 0);
  return {
    totalAssetsCents,
    totalLiabilitiesCents,
    netWorthCents: totalAssetsCents - totalLiabilitiesCents,
  };
}

export type PatrimonioMonthPoint = PatrimonioTotals & { monthKey: string };

/** One point per month in [fromMonthKey, toMonthKey] — the series behind
 * the Evolução do Patrimônio Líquido chart. */
export function getMonthlySeries(data: PatrimonioData, fromMonthKey: string, toMonthKey: string): PatrimonioMonthPoint[] {
  const points: PatrimonioMonthPoint[] = [];
  let cursor = fromMonthKey;
  // Bounded by construction (callers pass a small, fixed month range),
  // never by user input directly, so a plain while is safe here.
  while (monthKeyToIndex(cursor) <= monthKeyToIndex(toMonthKey)) {
    points.push({ monthKey: cursor, ...computeTotals(data, cursor) });
    cursor = shiftMonthKey(cursor, 1);
  }
  return points;
}

export type CategoryComposition = { category: string; label: string; valueCents: number };

export function getAssetComposition(data: PatrimonioData, monthKey: string): CategoryComposition[] {
  const totals = new Map<PatrimonioAssetCategory, number>();
  for (const asset of data.assets) {
    if (!asset.isActive) continue;
    const { valueCents } = assetEffectiveValue(asset, monthKey, data.confirmations);
    totals.set(asset.category, (totals.get(asset.category) ?? 0) + valueCents);
  }
  return Array.from(totals.entries())
    .filter(([, valueCents]) => valueCents > 0)
    .map(([category, valueCents]) => ({
      category,
      label: PATRIMONIO_ASSET_CATEGORY_LABELS[category],
      valueCents,
    }));
}

export function getLiabilityComposition(data: PatrimonioData, monthKey: string): CategoryComposition[] {
  const totals = new Map<PatrimonioLiabilityCategory, number>();
  for (const liability of data.liabilities) {
    if (!liability.isActive) continue;
    const { valueCents } = liabilityEffectiveValue(liability, monthKey, data.confirmations);
    totals.set(liability.category, (totals.get(liability.category) ?? 0) + valueCents);
  }
  return Array.from(totals.entries())
    .filter(([, valueCents]) => valueCents > 0)
    .map(([category, valueCents]) => ({
      category,
      label: PATRIMONIO_LIABILITY_CATEGORY_LABELS[category],
      valueCents,
    }));
}

/** Ativos ativos, agrupados por Uso Pessoal / Gerador de Renda —
 * alimenta o alternador de visão do donut de composição (ver
 * AssetCompositionDonut.tsx). Ativos sem `usageType` preenchido somam
 * como "Não informado". */
export function getAssetDistributionByUsage(data: PatrimonioData, monthKey: string): CategoryComposition[] {
  const totals = new Map<string, number>();
  for (const asset of data.assets) {
    if (!asset.isActive) continue;
    const key = asset.usageType ?? "NAO_INFORMADO";
    const { valueCents } = assetEffectiveValue(asset, monthKey, data.confirmations);
    totals.set(key, (totals.get(key) ?? 0) + valueCents);
  }
  const labels: Record<string, string> = {
    USO_PESSOAL: "Uso Pessoal",
    GERADOR_RENDA: "Gerador de Renda",
    NAO_INFORMADO: "Não informado",
  };
  return Array.from(totals.entries())
    .filter(([, valueCents]) => valueCents > 0)
    .map(([category, valueCents]) => ({ category, label: labels[category], valueCents }));
}

export function getAssetDistributionByLocation(data: PatrimonioData, monthKey: string): CategoryComposition[] {
  const totals = new Map<string, number>();
  for (const asset of data.assets) {
    if (!asset.isActive) continue;
    const key = asset.location ?? "NAO_INFORMADO";
    const { valueCents } = assetEffectiveValue(asset, monthKey, data.confirmations);
    totals.set(key, (totals.get(key) ?? 0) + valueCents);
  }
  const labels: Record<string, string> = {
    ONSHORE: "Onshore",
    OFFSHORE: "Offshore",
    NAO_INFORMADO: "Não informado",
  };
  return Array.from(totals.entries())
    .filter(([, valueCents]) => valueCents > 0)
    .map(([category, valueCents]) => ({ category, label: labels[category], valueCents }));
}

/** Liquidez is required going forward (src/lib/validation.ts), but
 * registros anteriores to that rule can still be null — those fall
 * into "Não informado" here rather than being excluded, same treatment
 * Tipo/Localização already got before they had their own required
 * rules. */
export function getAssetDistributionByLiquidity(data: PatrimonioData, monthKey: string): CategoryComposition[] {
  const totals = new Map<string, number>();
  for (const asset of data.assets) {
    if (!asset.isActive) continue;
    const key = asset.liquidity ?? "NAO_INFORMADO";
    const { valueCents } = assetEffectiveValue(asset, monthKey, data.confirmations);
    totals.set(key, (totals.get(key) ?? 0) + valueCents);
  }
  const labels: Record<string, string> = {
    ALTA: "Alta Liquidez",
    MEDIA: "Média Liquidez",
    BAIXA: "Baixa Liquidez",
    NAO_INFORMADO: "Não informado",
  };
  return Array.from(totals.entries())
    .filter(([, valueCents]) => valueCents > 0)
    .map(([category, valueCents]) => ({ category, label: labels[category], valueCents }));
}

/** The real first month this user has anything to show — the earliest
 * `createdAt` among their still-existing (not hard-deleted) ativos e
 * passivos, active or not: an item later inactivated/excluded was still
 * real patrimônio during the months it existed, so it still anchors
 * where the history honestly begins. Returns null when there's nothing
 * cadastrado at all yet — callers should show the chart's own empty
 * state rather than any range. Never a fixed "últimos 12 meses" window
 * (spec: no fabricated months, no zeros before the user's real start). */
export function firstPatrimonioMonthKey(data: PatrimonioData): string | null {
  const dates = [...data.assets, ...data.liabilities].map((item) => item.createdAt);
  if (dates.length === 0) return null;
  const earliest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  return monthKeyFromDate(earliest);
}

export type DebtRatio = {
  /** 0-100, or null when there are no ativos to divide by (never a
   * divide-by-zero NaN/Infinity reaching the UI). */
  pct: number | null;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
};

/** "Nível de Endividamento" = Passivos Totais ÷ Ativos Totais — a
 * single current-moment indicator, deliberately with no historical
 * series (spec: not implementing an evolution chart for this one). */
export function computeDebtRatio(totals: PatrimonioTotals): DebtRatio {
  const pct = totals.totalAssetsCents > 0 ? (totals.totalLiabilitiesCents / totals.totalAssetsCents) * 100 : null;
  return { pct, totalAssetsCents: totals.totalAssetsCents, totalLiabilitiesCents: totals.totalLiabilitiesCents };
}

export type ProtectionSummary = {
  necessarias: number;
  possuidas: number;
  pendentes: number;
  /** 0-100, or null when nothing is marked "Precisa" yet. */
  pctCoverage: number | null;
};

/** Counts, not values — matches the reference spreadsheet's own
 * "Nec"/"Cob" tally (13 necessárias, 12 cobertas -> 92.3%), not a
 * weighted-by-value measure. A proteção only ever counts as "possuída"
 * when it was also marked necessária (spec section 8: never count an
 * unnecessary one as coverage), and "pendente" is exactly Necessidade=
 * Precisa AND Coberto=Não possui (section 7's pendency rule). */
export function computeProtectionSummary(data: PatrimonioData): ProtectionSummary {
  const active = data.protections.filter((p) => p.isActive);
  const necessarias = active.filter((p) => p.isNeeded === true).length;
  const possuidas = active.filter((p) => p.isNeeded === true && p.isCovered === true).length;
  const pendentes = necessarias - possuidas;
  const pctCoverage = necessarias > 0 ? (possuidas / necessarias) * 100 : null;
  return { necessarias, possuidas, pendentes, pctCoverage };
}

export type ProtectionDetailStatus = "POSSUIDA" | "PENDENTE" | "NAO_NECESSARIA";
export type ProtectionDetailRow = { id: string; element: string; status: ProtectionDetailStatus };

/** Per-elemento status for the detailed breakdown view — the same
 * classification computeProtectionSummary tallies, just kept per-row
 * instead of counted. */
export function getProtectionDetailRows(data: PatrimonioData): ProtectionDetailRow[] {
  return data.protections
    .filter((p) => p.isActive)
    .map((p): ProtectionDetailRow => {
      const status: ProtectionDetailStatus =
        p.isNeeded === true ? (p.isCovered === true ? "POSSUIDA" : "PENDENTE") : "NAO_NECESSARIA";
      return { id: p.id, element: p.element, status };
    });
}

const SUCCESSION_META_FRACTION = 0.2;
// Matched by exact name (case/whitespace-insensitive) against the 5
// canonical elementos — a renamed or custom item simply isn't counted
// as sucessório, matching the spec's "não considerar automaticamente
// todos os itens de proteção como sucessórios."
const SUCCESSION_ELEMENT_NAMES = new Set(["seguro de vida", "previdência vgbl", "previdência pgbl", "holding", "offshore"]);

function isSuccessionElement(element: string): boolean {
  return SUCCESSION_ELEMENT_NAMES.has(element.trim().toLowerCase());
}

export type SuccessionPlanning = {
  totalAssetsCents: number;
  metaCents: number;
  currentCents: number;
  gapCents: number;
  /** 0-100+, or null when Ativos Totais is 0 (meta would be 0 too). */
  pctCoverage: number | null;
  byElement: CategoryComposition[];
};

/** "Planejamento Sucessório" — compares the current value of the 5
 * sucessório-relevant proteções against a 20%-of-ativos target. Reuses
 * `totalAssetsCents` from computeTotals rather than recomputing it, so
 * this always agrees with the headline Ativos Totais card. */
export function computeSuccessionPlanning(data: PatrimonioData, totalAssetsCents: number): SuccessionPlanning {
  const matched = data.protections.filter((p) => p.isActive && isSuccessionElement(p.element));
  const currentCents = matched.reduce((sum, p) => sum + (p.currentValueCents ?? 0), 0);
  const metaCents = Math.round(totalAssetsCents * SUCCESSION_META_FRACTION);
  const gapCents = Math.max(0, metaCents - currentCents);
  const pctCoverage = metaCents > 0 ? (currentCents / metaCents) * 100 : null;
  const byElement: CategoryComposition[] = matched
    .filter((p) => (p.currentValueCents ?? 0) > 0)
    .map((p) => ({ category: p.id, label: p.element, valueCents: p.currentValueCents ?? 0 }));
  return { totalAssetsCents, metaCents, currentCents, gapCents, pctCoverage, byElement };
}

export type PatrimonioSnapshotRow = {
  kind: "asset" | "liability";
  id: string;
  name: string;
  categoryLabel: string;
  valueCents: number;
  origin: ValueOrigin;
};

/** One row per ativo/passivo ativo, for the "Fotografia do mês" panel —
 * whichever month the user is currently looking at. */
export function getMonthSnapshotRows(data: PatrimonioData, monthKey: string): PatrimonioSnapshotRow[] {
  const assetRows: PatrimonioSnapshotRow[] = data.assets
    .filter((a) => a.isActive)
    .map((a) => {
      const { valueCents, origin } = assetEffectiveValue(a, monthKey, data.confirmations);
      return {
        kind: "asset",
        id: a.id,
        name: a.name,
        categoryLabel: PATRIMONIO_ASSET_CATEGORY_LABELS[a.category],
        valueCents,
        origin,
      };
    });
  const liabilityRows: PatrimonioSnapshotRow[] = data.liabilities
    .filter((l) => l.isActive)
    .map((l) => {
      const { valueCents, origin } = liabilityEffectiveValue(l, monthKey, data.confirmations);
      return {
        kind: "liability",
        id: l.id,
        name: l.name,
        categoryLabel: PATRIMONIO_LIABILITY_CATEGORY_LABELS[l.category],
        valueCents,
        origin,
      };
    });
  return [...assetRows, ...liabilityRows];
}

/** "Complementação necessária" from the spec — never stored, always
 * derived: how much more coverage a proteção still needs. Null when
 * either side isn't filled in yet. */
export function protectionGapCents(protection: PatrimonioProtection): number | null {
  if (protection.idealValueCents == null || protection.currentValueCents == null) return null;
  return Math.max(0, protection.idealValueCents - protection.currentValueCents);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Discriminated on `ratePct` so a consumer that checks `ratePct !== null`
 * gets purchaseValueCents/purchaseDate/days narrowed to non-null too,
 * instead of needing separate null checks (or `!` assertions) for each
 * — they're only ever null or non-null together. */
export type AssetAppreciationRate =
  | {
      ratePct: null;
      purchaseValueCents: number | null;
      currentValueCents: number;
      purchaseDate: Date | null;
      /** The date Valor Atual was last effectively updated — the newest
       * PatrimonioValueChange for this asset, or the asset's own
       * createdAt when its value has never changed since cadastro.
       * Never "hoje". */
      valueAsOfDate: Date;
      days: null;
    }
  | {
      /** Annualized valorização/desvalorização in percent (e.g. 5.42
       * means "+5,42% a.a."). */
      ratePct: number;
      purchaseValueCents: number;
      currentValueCents: number;
      purchaseDate: Date;
      valueAsOfDate: Date;
      /** Real calendar days between purchaseDate and valueAsOfDate. */
      days: number;
    };

/** "Taxa de Correção Anual (%)" for Bens Móveis/Imóveis/Intangível/
 * Colecionáveis — the column keeps its existing name and position, but
 * is now always a computed, read-only annualized rate
 * ((Valor Atual ÷ Valor de Compra) ^ (365 ÷ dias) - 1) between the
 * purchase and the last real value update, never a manually-typed
 * figure and never anchored to today's date. This is deliberately
 * decoupled from the `annualRatePct` DB column, which keeps its
 * original role as the (currently unreachable — no UI sets
 * updateMethod to PROJECAO_AUTOMATICA) manual rate the sparse
 * confirmation ledger's projection engine (effectiveValueFor above)
 * would compound forward from; this function never reads or writes
 * that column. */
/** The date Valor Atual was last effectively updated for one asset —
 * the newest PatrimonioValueChange for it, or the asset's own
 * createdAt when its value has never changed since cadastro. Never
 * "hoje". Shared by every computed indicator that needs a real "as of"
 * date (computeAssetAppreciationRate, computeCapitalReturn below).
 * `valueChanges` is sorted newest-first (getPatrimonioData), so the
 * first match for this asset is its most recent value update. */
function latestValueAsOfDate(assetId: string, createdAt: Date, valueChanges: PatrimonioValueChange[]): Date {
  const latestChange = valueChanges.find((vc) => vc.assetId === assetId);
  return latestChange ? latestChange.createdAt : createdAt;
}

export function computeAssetAppreciationRate(
  asset: Pick<PatrimonioAsset, "id" | "createdAt" | "purchaseValueCents" | "currentValueCents" | "purchaseDate">,
  valueChanges: PatrimonioValueChange[]
): AssetAppreciationRate {
  const valueAsOfDate = latestValueAsOfDate(asset.id, asset.createdAt, valueChanges);
  const { purchaseValueCents, currentValueCents, purchaseDate } = asset;

  if (purchaseValueCents == null || purchaseValueCents <= 0 || purchaseDate == null) {
    return { ratePct: null, purchaseValueCents, currentValueCents, purchaseDate, valueAsOfDate, days: null };
  }

  const days = Math.round((valueAsOfDate.getTime() - purchaseDate.getTime()) / MS_PER_DAY);
  if (!Number.isFinite(days) || days <= 0) {
    return { ratePct: null, purchaseValueCents, currentValueCents, purchaseDate, valueAsOfDate, days: null };
  }

  const ratePct = (Math.pow(currentValueCents / purchaseValueCents, 365 / days) - 1) * 100;
  return { ratePct, purchaseValueCents, currentValueCents, purchaseDate, valueAsOfDate, days };
}

/** One computeAssetAppreciationRate call per asset, keyed by id — built
 * once in page.tsx and passed down as a plain prop so client table
 * components never need to import this module (it pulls in
 * @/lib/prisma) just to read a number they didn't compute themselves. */
export function buildAssetAppreciationMap(data: PatrimonioData): Record<string, AssetAppreciationRate> {
  const result: Record<string, AssetAppreciationRate> = {};
  for (const asset of data.assets) {
    result[asset.id] = computeAssetAppreciationRate(asset, data.valueChanges);
  }
  return result;
}

/** "Retorno sobre o Capital Investido (%)" — Bens Imóveis/Bens Móveis/
 * Colecionáveis only (Intangível keeps the older, single-figure "Taxa
 * de Correção Anual (%)" above, untouched). Two independent figures in
 * one cell: Retorno Total (a plain percentage gain over the capital
 * invested, no time dimension) and Retorno Anualizado (the same CAGR
 * shape as computeAssetAppreciationRate, just against Capital Total
 * Investido instead of Valor de Compra alone). Either can be null on
 * its own — Total only needs Capital Total Investido > 0, Anualizado
 * additionally needs a real purchase date and a positive elapsed
 * period — so a missing Data de Compra shows Total but "—" for a.a.,
 * never a fabricated one. */
export type CapitalReturn = {
  totalPct: number | null;
  annualizedPct: number | null;
  purchaseValueCents: number | null;
  /** Bens Móveis/Colecionáveis never set this column, so it's always 0
   * for them — Capital Total Investido then reduces to Valor de Compra
   * exactly, with no category branch needed here. */
  additionalInvestmentCents: number;
  capitalInvestedCents: number | null;
  currentValueCents: number;
  purchaseDate: Date | null;
  valueAsOfDate: Date;
  days: number | null;
};

export function computeCapitalReturn(
  asset: Pick<
    PatrimonioAsset,
    "id" | "createdAt" | "purchaseValueCents" | "currentValueCents" | "purchaseDate" | "additionalInvestmentCents"
  >,
  valueChanges: PatrimonioValueChange[]
): CapitalReturn {
  const valueAsOfDate = latestValueAsOfDate(asset.id, asset.createdAt, valueChanges);
  const { purchaseValueCents, currentValueCents, purchaseDate } = asset;
  const additionalInvestmentCents = asset.additionalInvestmentCents ?? 0;
  const capitalInvestedCents = purchaseValueCents != null ? purchaseValueCents + additionalInvestmentCents : null;

  const base = {
    purchaseValueCents,
    additionalInvestmentCents,
    capitalInvestedCents,
    currentValueCents,
    purchaseDate,
    valueAsOfDate,
  };

  if (capitalInvestedCents == null || capitalInvestedCents <= 0) {
    return { ...base, totalPct: null, annualizedPct: null, days: null };
  }

  const totalPct = (currentValueCents / capitalInvestedCents - 1) * 100;

  if (purchaseDate == null) {
    return { ...base, totalPct, annualizedPct: null, days: null };
  }
  const days = Math.round((valueAsOfDate.getTime() - purchaseDate.getTime()) / MS_PER_DAY);
  if (!Number.isFinite(days) || days <= 0) {
    return { ...base, totalPct, annualizedPct: null, days: null };
  }

  const annualizedPct = (Math.pow(currentValueCents / capitalInvestedCents, 365 / days) - 1) * 100;
  return { ...base, totalPct, annualizedPct, days };
}

export function buildCapitalReturnMap(data: PatrimonioData): Record<string, CapitalReturn> {
  const result: Record<string, CapitalReturn> = {};
  for (const asset of data.assets) {
    result[asset.id] = computeCapitalReturn(asset, data.valueChanges);
  }
  return result;
}
