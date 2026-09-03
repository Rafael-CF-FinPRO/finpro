import { prisma } from "@/lib/prisma";
import { monthRangeForKey, enumerateMonthKeys, formatMonthKeyShortLabel } from "@/lib/dates";
import {
  BUDGET_CLASSIFICATIONS,
  computeBudgetPct,
  computeBudgetStatus,
  computeBudgetHealth,
  type BudgetStatus,
  type BudgetHealth,
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

export async function getBudgetOverview(
  userId: string,
  monthKey: string
): Promise<BudgetOverview> {
  const profile = await getBudgetProfile(userId);

  if (!profile) {
    return {
      hasProfile: false,
      monthlyIncomeCents: 0,
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

  const [customCount, categories] = await Promise.all([
    prisma.budgetClassificationAllocation.count({
      where: { budgetProfileId: profile.id, monthKey },
    }),
    prisma.category.findMany({
      where: { userId, type: "SAIDA" },
      orderBy: [{ classification: "asc" }, { order: "asc" }],
    }),
  ]);

  const isCustomMonth = customCount > 0;
  const scopeKey = isCustomMonth ? monthKey : "default";
  const { from, to } = monthRangeForKey(monthKey);

  const [classificationAllocations, categoryAllocations, realizedByCategory] =
    await Promise.all([
      prisma.budgetClassificationAllocation.findMany({
        where: { budgetProfileId: profile.id, monthKey: scopeKey },
      }),
      prisma.budgetCategoryAllocation.findMany({
        where: { budgetProfileId: profile.id, monthKey: scopeKey },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, type: "SAIDA", date: { gte: from, lt: to } },
        _sum: { amountCents: true },
      }),
    ]);

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

export type BudgetHistoryMonth = {
  monthKey: string;
  label: string;
  shortLabel: string;
  budgetedCents: number;
  realizedCents: number;
};

export type BudgetHistoryClassificationRow = {
  classification: Classification;
  budgetedCents: number;
  realizedCents: number;
  avgRealizedCents: number;
  pctGasto: number | null;
  status: BudgetStatus;
  health: BudgetHealth;
};

export type BudgetHistory = {
  hasProfile: boolean;
  fromMonthKey: string;
  toMonthKey: string;
  months: BudgetHistoryMonth[];
  classifications: BudgetHistoryClassificationRow[];
  totals: {
    incomeCents: number;
    budgetedCents: number;
    realizedCents: number;
    avgRealizedCents: number;
  };
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
      months: [],
      classifications: [],
      totals: { incomeCents: 0, budgetedCents: 0, realizedCents: 0, avgRealizedCents: 0 },
    };
  }

  const monthKeys = enumerateMonthKeys(fromMonthKey, toMonthKey);
  const overviews = await Promise.all(
    monthKeys.map((monthKey) => getBudgetOverview(userId, monthKey))
  );

  const months: BudgetHistoryMonth[] = overviews.map((ov) => ({
    monthKey: ov.monthKey,
    label: ov.monthKey,
    shortLabel: formatMonthKeyShortLabel(ov.monthKey),
    budgetedCents: ov.totals.budgetedCents,
    realizedCents: ov.totals.realizedCents,
  }));

  const monthCount = Math.max(overviews.length, 1);

  const classifications: BudgetHistoryClassificationRow[] = BUDGET_CLASSIFICATIONS.map(
    (classification) => {
      let budgetedCents = 0;
      let realizedCents = 0;
      for (const ov of overviews) {
        const row = ov.classifications.find((c) => c.classification === classification);
        budgetedCents += row?.budgetedCents ?? 0;
        realizedCents += row?.realizedCents ?? 0;
      }
      return {
        classification,
        budgetedCents,
        realizedCents,
        avgRealizedCents: Math.round(realizedCents / monthCount),
        pctGasto: computeBudgetPct(realizedCents, budgetedCents),
        status: computeBudgetStatus(realizedCents, budgetedCents),
        health: computeBudgetHealth(realizedCents, budgetedCents),
      };
    }
  );

  const totalBudgeted = months.reduce((s, m) => s + m.budgetedCents, 0);
  const totalRealized = months.reduce((s, m) => s + m.realizedCents, 0);

  return {
    hasProfile: true,
    fromMonthKey,
    toMonthKey,
    months,
    classifications,
    totals: {
      incomeCents: profile.monthlyIncomeCents * monthCount,
      budgetedCents: totalBudgeted,
      realizedCents: totalRealized,
      avgRealizedCents: Math.round(totalRealized / monthCount),
    },
  };
}
