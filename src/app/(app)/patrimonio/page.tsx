import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { requireModuleAccess } from "@/lib/modules";
import { currentMonthKey } from "@/lib/dates";
import {
  getPatrimonioData,
  computeTotals,
  getMonthlySeries,
  getAssetComposition,
  getLiabilityComposition,
  getAssetDistributionByUsage,
  getAssetDistributionByLocation,
  getAssetDistributionByLiquidity,
  firstPatrimonioMonthKey,
  computeDebtRatio,
  computeProtectionSummary,
  getProtectionDetailRows,
  computeSuccessionPlanning,
  buildAssetAppreciationMap,
  buildCapitalReturnMap,
} from "@/lib/patrimonio";
import { PatrimonioBoard } from "@/components/patrimonio/PatrimonioBoard";

export const metadata: Metadata = {
  title: "Gestão Patrimonial | FinPRO",
};

export default async function PatrimonioPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  await requireModuleAccess("gestao_patrimonial");

  const currentMonth = currentMonthKey();
  const data = await getPatrimonioData(session.userId);

  const totals = computeTotals(data, currentMonth);
  // The evolution chart only ever covers the user's real history — the
  // first month they actually had something cadastrado through today —
  // never a fixed "últimos 12 meses" window with fabricated leading
  // zeros (spec section 3). No cadastro yet -> no range at all; the
  // chart itself renders its own empty state for an empty series.
  const firstMonthKey = firstPatrimonioMonthKey(data);
  const series = firstMonthKey ? getMonthlySeries(data, firstMonthKey, currentMonth) : [];
  const assetsByCategory = getAssetComposition(data, currentMonth);
  const assetsByUsage = getAssetDistributionByUsage(data, currentMonth);
  const assetsByLocation = getAssetDistributionByLocation(data, currentMonth);
  const assetsByLiquidity = getAssetDistributionByLiquidity(data, currentMonth);
  const liabilitiesByCategory = getLiabilityComposition(data, currentMonth);
  const debtRatio = computeDebtRatio(totals);
  const protectionSummary = computeProtectionSummary(data);
  const protectionDetailRows = getProtectionDetailRows(data);
  const successionPlanning = computeSuccessionPlanning(data, totals.totalAssetsCents);
  const assetAppreciationById = buildAssetAppreciationMap(data);
  const capitalReturnById = buildCapitalReturnMap(data);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Gestão Patrimonial</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Cadastre seus bens, dívidas e proteções uma vez e acompanhe a evolução do seu patrimônio líquido mês a mês.
      </p>

      <div className="mt-6">
        <PatrimonioBoard
          assets={data.assets}
          liabilities={data.liabilities}
          protections={data.protections}
          totals={totals}
          series={series}
          assetsByCategory={assetsByCategory}
          assetsByUsage={assetsByUsage}
          assetsByLocation={assetsByLocation}
          assetsByLiquidity={assetsByLiquidity}
          liabilitiesByCategory={liabilitiesByCategory}
          debtRatio={debtRatio}
          protectionSummary={protectionSummary}
          protectionDetailRows={protectionDetailRows}
          successionPlanning={successionPlanning}
          assetAppreciationById={assetAppreciationById}
          capitalReturnById={capitalReturnById}
        />
      </div>
    </div>
  );
}
