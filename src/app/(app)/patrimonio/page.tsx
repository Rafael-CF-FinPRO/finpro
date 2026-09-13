import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { requireModuleAccess } from "@/lib/modules";
import { currentMonthKey, isValidMonthKey, shiftMonthKey } from "@/lib/dates";
import {
  getPatrimonioData,
  computeTotals,
  getMonthlySeries,
  getAssetComposition,
  getLiabilityComposition,
  getAssetDistributionByUsage,
  getAssetDistributionByLocation,
  getMonthSnapshotRows,
} from "@/lib/patrimonio";
import { PatrimonioBoard } from "@/components/patrimonio/PatrimonioBoard";

export const metadata: Metadata = {
  title: "Gestão Patrimonial | FinPRO",
};

const SERIES_MONTHS = 11;

export default async function PatrimonioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  await requireModuleAccess("gestao_patrimonial");

  const params = await searchParams;
  const requestedMonth = typeof params.month === "string" ? params.month : "";
  const confirmMonthKey = isValidMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();

  const currentMonth = currentMonthKey();
  const data = await getPatrimonioData(session.userId);

  const totals = computeTotals(data, currentMonth);
  const series = getMonthlySeries(data, shiftMonthKey(currentMonth, -SERIES_MONTHS), currentMonth);
  const assetsByCategory = getAssetComposition(data, currentMonth);
  const assetsByUsage = getAssetDistributionByUsage(data, currentMonth);
  const assetsByLocation = getAssetDistributionByLocation(data, currentMonth);
  const liabilitiesByCategory = getLiabilityComposition(data, currentMonth);
  const snapshotRows = getMonthSnapshotRows(data, confirmMonthKey);

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
          liabilitiesByCategory={liabilitiesByCategory}
          confirmMonthKey={confirmMonthKey}
          snapshotRows={snapshotRows}
        />
      </div>
    </div>
  );
}
