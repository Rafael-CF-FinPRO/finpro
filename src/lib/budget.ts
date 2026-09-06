import { prisma } from "@/lib/prisma";
import { monthRangeForKey, enumerateMonthKeys, formatMonthKeyShortLabel } from "@/lib/dates";
import {
  BUDGET_CLASSIFICATIONS,
  computeBudgetPct,
  computeBudgetStatus,
  computeOverallCompliancePct,
  type BudgetStatus,
} from "@/lib/budget-calc";
import type { Classification } from "@/generated/prisma/enums";

export type { BudgetStatus };

export type CategoryBudgetRow = {
  categoryId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  percentage: number;
  isConfigured: boolean;
  budgetedCents: number;
  realizedCents: number;
  pctGasto: number | null;
  status: BudgetStatus;
};

export type ClassificationBudgetRow = {
  classification: Classification;
  percentage: number;
  isConfigured: boolean;
  budgetedCents: number;
  realizedCents: number;
  pctGasto: number | null;
  status: BudgetStatus;
  categories: CategoryBudgetRow[];
};

export type BudgetOverview = {
  hasProfile: boolean;
  monthlyIncomeCents: number;
  /** Actual money that came in this month (sum of ENTRADA transactions,
   * status PAGO) — distinct from monthlyIncomeCents, which is the fixed
   * reference income the user configured for budgeting purposes. Used
   * by the Dashboard's monthly view as the real starting point of the
   * month ("Receita"), never for anything that derives Orçado/Meta
   * figures — those stay tied to monthlyIncomeCents, unchanged. */
  realizedIncomeCents: number;
  monthKey: string;
  isCustomMonth: boolean;
  classifications: ClassificationBudgetRow[];
  totals: {
    budgetedCents: number;
    realizedCents: number;
    availableCents: number;
    usedPct: number | null;
  };
};

export async function getBudgetProfile(userId: string) {
  return prisma.budgetProfile.findUnique({ where: { userId } });
}

/** All of getBudgetOverview's reads in one round trip. Classification/
 * category allocations are fetched for BOTH `monthKey` and "default" at
 * once (filtering through the budgetProfile relation, so this doesn't
 * even have to wait on the profile lookup) — isCustomMonth/scopeKey is
 * then resolved from those already-fetched rows instead of a separate
 * count() query. Previously this was 3 sequential waterfall legs
 * (profile → count+categories → allocations+realized); collapsing them
 * matters most for the Dashboard's Visão Histórica, which calls this
 * once per month in the range — each month's fetch now costs one round
 * trip instead of three. */
export async function getBudgetOverview(
  userId: string,
  monthKey: string
): Promise<BudgetOverview> {
  const { from, to } = monthRangeForKey(monthKey);

  const [
    profile,
    categories,
    realizedByCategory,
    realizedIncomeAgg,
    classificationAllocationsBoth,
    categoryAllocationsBoth,
  ] = await Promise.all([
    getBudgetProfile(userId),
    prisma.category.findMany({
      where: { userId, type: "SAIDA" },
      orderBy: [{ classification: "asc" }, { order: "asc" }],
    }),
    // status: "PAGO" excludes not-yet-paid recurring/installment
    // occurrences from Realizado — a predicted bill due later this
    // month must not count as money already spent, the same way
    // type: "SAIDA" already excludes NEUTRO.
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "SAIDA", status: "PAGO", date: { gte: from, lt: to } },
      _sum: { amountCents: true },
    }),
    // Real money in this month, for the Dashboard's "Receita" — same
    // PAGO/date-range convention as realizedByCategory above.
    prisma.transaction.aggregate({
      where: { userId, type: "ENTRADA", status: "PAGO", date: { gte: from, lt: to } },
      _sum: { amountCents: true },
    }),
    prisma.budgetClassificationAllocation.findMany({
      where: { budgetProfile: { userId }, monthKey: { in: [monthKey, "default"] } },
    }),
    prisma.budgetCategoryAllocation.findMany({
      where: { budgetProfile: { userId }, monthKey: { in: [monthKey, "default"] } },
    }),
  ]);

  if (!profile) {
    return {
      hasProfile: false,
      monthlyIncomeCents: 0,
      realizedIncomeCents: 0,
      monthKey,
      isCustomMonth: false,
      classifications: [],
      totals: {
        budgetedCents: 0,
        realizedCents: 0,
        availableCents: 0,
        usedPct: null,
      },
    };
  }

  const isCustomMonth = classificationAllocationsBoth.some((a) => a.monthKey === monthKey);
  const scopeKey = isCustomMonth ? monthKey : "default";
  const classificationAllocations = classificationAllocationsBoth.filter(
    (a) => a.monthKey === scopeKey
  );
  const categoryAllocations = categoryAllocationsBoth.filter((a) => a.monthKey === scopeKey);

  const realizedMap = new Map(
    realizedByCategory.map((r) => [r.categoryId, r._sum.amountCents ?? 0])
  );
  const classificationPctMap = new Map(
    classificationAllocations.map((a) => [a.classification, a.percentage])
  );
  const categoryPctMap = new Map(
    categoryAllocations.map((a) => [a.categoryId, a.percentage])
  );

  const classifications: ClassificationBudgetRow[] = BUDGET_CLASSIFICATIONS.map(
    (classification) => {
      const percentage = classificationPctMap.get(classification) ?? 0;
      const budgetedCents = Math.round(
        (profile.monthlyIncomeCents * percentage) / 100
      );

      const categoryRows: CategoryBudgetRow[] = categories
        .filter((c) => c.classification === classification)
        .map((cat) => {
          const catPercentage = categoryPctMap.get(cat.id) ?? 0;
          // A Category's value is a direct percentage of total income —
          // never a percentage of its Classification's amount. See the
          // comment on BudgetCategoryAllocation in schema.prisma.
          const catBudgeted = Math.round(
            (profile.monthlyIncomeCents * catPercentage) / 100
          );
          const catRealized = realizedMap.get(cat.id) ?? 0;
          return {
            categoryId: cat.id,
            name: cat.name,
            description: cat.description,
            isActive: cat.isActive,
            percentage: catPercentage,
            isConfigured: categoryPctMap.has(cat.id),
            budgetedCents: catBudgeted,
            realizedCents: catRealized,
            pctGasto: computeBudgetPct(catRealized, catBudgeted),
            status: computeBudgetStatus(catRealized, catBudgeted),
          };
        });

      const realizedCents = categoryRows.reduce((sum, c) => sum + c.realizedCents, 0);

      return {
        classification,
        percentage,
        isConfigured: classificationPctMap.has(classification),
        budgetedCents,
        realizedCents,
        pctGasto: computeBudgetPct(realizedCents, budgetedCents),
        status: computeBudgetStatus(realizedCents, budgetedCents),
        categories: categoryRows,
      };
    }
  );

  const totalBudgeted = classifications.reduce((s, c) => s + c.budgetedCents, 0);
  const totalRealized = classifications.reduce((s, c) => s + c.realizedCents, 0);

  return {
    hasProfile: true,
    monthlyIncomeCents: profile.monthlyIncomeCents,
    realizedIncomeCents: realizedIncomeAgg._sum.amountCents ?? 0,
    monthKey,
    isCustomMonth,
    classifications,
    totals: {
      budgetedCents: totalBudgeted,
      realizedCents: totalRealized,
      availableCents: totalBudgeted - totalRealized,
      usedPct: computeBudgetPct(totalRealized, totalBudgeted),
    },
  };
}

/** One month's worth of the historical evolution — everything the
 * Dashboard's Visão Histórica charts need per month, all derived from
 * that month's own getBudgetOverview (never re-deriving a calculation
 * that already exists there). Despesas is deliberately NOT a field
 * here: Custos Obrigatórios and Prazeres e Confortos stay separate
 * (Evolução Financeira plots them as distinct lines), same as
 * Investimentos never being folded into a generic "despesa" — it's a
 * destination for money, not consumption. */
export type BudgetHistoryMonthRow = {
  monthKey: string;
  shortLabel: string;
  receitaCents: number;
  custosCents: number;
  custosBudgetedCents: number;
  prazeresCents: number;
  prazeresBudgetedCents: number;
  investimentosCents: number;
  /** The month's investment goal — same field as budgetedCents
   * elsewhere, named "meta" here since that's what it is for a goal
   * classification (see isGoalClassification in budget-calc.ts). */
  investimentosMetaCents: number;
  saldoCents: number;
  /** Cumprimento do Orçamento for that single month — same formula as
   * BudgetComplianceScore (computeOverallCompliancePct), just computed
   * per month instead of once for the selected month. */
  compliancePct: number;
  /** Every category (any of the 3 classifications, Investimentos
   * included — unlike the period-level Top 10) with realized spending
   * that specific month — for "Distribuição dos Gastos"' Categorias
   * view, which needs a per-month breakdown, not just a period total. */
  categories: { categoryId: string; name: string; classification: Classification; realizedCents: number }[];
};

/** One category's totals across the whole period — for "Top 10
 * Categorias". Investimentos categories are excluded, same convention
 * as the monthly view's own Top 10 (it isn't spending to rank — it's
 * tracked as a goal in its own section). Only categories with any
 * realized spending across the period appear at all. */
export type BudgetHistoryCategoryRow = {
  categoryId: string;
  name: string;
  classification: Classification;
  totalRealizedCents: number;
  avgRealizedCents: number;
};

export type BudgetHistory = {
  hasProfile: boolean;
  fromMonthKey: string;
  toMonthKey: string;
  monthCount: number;
  months: BudgetHistoryMonthRow[];
  categories: BudgetHistoryCategoryRow[];
  totals: {
    receitaCents: number;
    despesasCents: number;
    custosCents: number;
    prazeresCents: number;
    investimentosCents: number;
    saldoCents: number;
  };
  averages: {
    receitaCents: number;
    despesasCents: number;
    investimentosCents: number;
    saldoCents: number;
  };
};

const EMPTY_BUDGET_HISTORY_TOTALS = {
  receitaCents: 0,
  despesasCents: 0,
  custosCents: 0,
  prazeresCents: 0,
  investimentosCents: 0,
  saldoCents: 0,
};

/** Aggregates getBudgetOverview across every month from fromMonthKey to
 * toMonthKey (inclusive) — reusing it rather than re-deriving the
 * default-vs-custom-month resolution logic, so a personalized month
 * inside the range is still accounted for correctly. Used by the
 * Dashboard's "Visão Histórica" — the monthly view keeps using
 * getBudgetOverview directly. */
export async function getBudgetHistory(
  userId: string,
  fromMonthKey: string,
  toMonthKey: string
): Promise<BudgetHistory> {
  const profile = await getBudgetProfile(userId);

  if (!profile) {
    return {
      hasProfile: false,
      fromMonthKey,
      toMonthKey,
      monthCount: 0,
      months: [],
      categories: [],
      totals: EMPTY_BUDGET_HISTORY_TOTALS,
      averages: { receitaCents: 0, despesasCents: 0, investimentosCents: 0, saldoCents: 0 },
    };
  }

  const monthKeys = enumerateMonthKeys(fromMonthKey, toMonthKey);
  const overviews = await Promise.all(
    monthKeys.map((monthKey) => getBudgetOverview(userId, monthKey))
  );
  const monthCount = Math.max(overviews.length, 1);

  const rowFor = (
    ov: (typeof overviews)[number],
    classification: Classification
  ) => ov.classifications.find((c) => c.classification === classification);

  const months: BudgetHistoryMonthRow[] = overviews.map((ov) => {
    const custos = rowFor(ov, "CUSTOS_OBRIGATORIOS");
    const prazeres = rowFor(ov, "PRAZERES_E_CONFORTOS");
    const investimentos = rowFor(ov, "INVESTIMENTOS");
    const custosCents = custos?.realizedCents ?? 0;
    const prazeresCents = prazeres?.realizedCents ?? 0;
    const investimentosCents = investimentos?.realizedCents ?? 0;

    return {
      monthKey: ov.monthKey,
      shortLabel: formatMonthKeyShortLabel(ov.monthKey),
      receitaCents: ov.realizedIncomeCents,
      custosCents,
      custosBudgetedCents: custos?.budgetedCents ?? 0,
      prazeresCents,
      prazeresBudgetedCents: prazeres?.budgetedCents ?? 0,
      investimentosCents,
      investimentosMetaCents: investimentos?.budgetedCents ?? 0,
      saldoCents: ov.realizedIncomeCents - custosCents - prazeresCents - investimentosCents,
      compliancePct: computeOverallCompliancePct(ov.classifications),
      categories: ov.classifications.flatMap((cls) =>
        cls.categories
          .filter((cat) => cat.realizedCents > 0)
          .map((cat) => ({
            categoryId: cat.categoryId,
            name: cat.name,
            classification: cls.classification,
            realizedCents: cat.realizedCents,
          }))
      ),
    };
  });

  // One row per category with any realized spending across the period —
  // Investimentos excluded (see BudgetHistoryCategoryRow above).
  const categoryTotals = new Map<string, BudgetHistoryCategoryRow>();
  for (const ov of overviews) {
    for (const cls of ov.classifications) {
      if (cls.classification === "INVESTIMENTOS") continue;
      for (const cat of cls.categories) {
        if (cat.realizedCents <= 0) continue;
        const existing = categoryTotals.get(cat.categoryId);
        if (existing) {
          existing.totalRealizedCents += cat.realizedCents;
        } else {
          categoryTotals.set(cat.categoryId, {
            categoryId: cat.categoryId,
            name: cat.name,
            classification: cls.classification,
            totalRealizedCents: cat.realizedCents,
            avgRealizedCents: 0,
          });
        }
      }
    }
  }
  const categories = [...categoryTotals.values()].map((c) => ({
    ...c,
    avgRealizedCents: Math.round(c.totalRealizedCents / monthCount),
  }));

  const sumOf = (pick: (m: BudgetHistoryMonthRow) => number) =>
    months.reduce((sum, m) => sum + pick(m), 0);
  const totals = {
    receitaCents: sumOf((m) => m.receitaCents),
    despesasCents: sumOf((m) => m.custosCents + m.prazeresCents),
    custosCents: sumOf((m) => m.custosCents),
    prazeresCents: sumOf((m) => m.prazeresCents),
    investimentosCents: sumOf((m) => m.investimentosCents),
    saldoCents: sumOf((m) => m.saldoCents),
  };

  return {
    hasProfile: true,
    fromMonthKey,
    toMonthKey,
    monthCount: overviews.length,
    months,
    categories,
    totals,
    averages: {
      receitaCents: Math.round(totals.receitaCents / monthCount),
      despesasCents: Math.round(totals.despesasCents / monthCount),
      investimentosCents: Math.round(totals.investimentosCents / monthCount),
      saldoCents: Math.round(totals.saldoCents / monthCount),
    },
  };
}
