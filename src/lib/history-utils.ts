// Pure, dependency-free helpers shared between src/lib/budget.ts
// (server-only, imports Prisma) and Dashboard components that render
// under a Client Component (e.g. HistoricalOverviewCards.tsx) and so
// end up bundled for the browser — kept in their own file specifically
// so importing them never drags Prisma/pg's Node-only internals
// (fs/net/tls/dns) into a client bundle the way importing from
// budget.ts directly would.

/** Whether a month (or any object exposing these 4 realized totals) had
 * any real activity at all — see monthsWithDataCount in
 * src/lib/budget.ts for why this is the averaging denominator instead
 * of the raw number of months in the selected period. */
export function countMonthsWithData(
  months: {
    receitaCents: number;
    custosCents: number;
    prazeresCents: number;
    investimentosCents: number;
  }[]
): number {
  const withData = months.filter(
    (m) => m.receitaCents > 0 || m.custosCents > 0 || m.prazeresCents > 0 || m.investimentosCents > 0
  ).length;
  return Math.max(withData, 1);
}
