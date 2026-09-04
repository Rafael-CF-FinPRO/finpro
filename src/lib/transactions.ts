import { prisma } from "@/lib/prisma";
import {
  currentMonthRange,
  parseDateInputValue,
  previousMonthRange,
} from "@/lib/dates";
import {
  Classification,
  type TransactionStatus,
  type TransactionType,
} from "@/generated/prisma/enums";

export type PeriodFilter = "current" | "previous" | "custom";
export type TypeFilter = "all" | TransactionType;
export type ClassificationFilter = "all" | Classification;
export type StatusFilter = "all" | TransactionStatus;

export type TransactionFilters = {
  period: PeriodFilter;
  from?: string;
  to?: string;
  type: TypeFilter;
  categoryId?: string;
  classification: ClassificationFilter;
  status: StatusFilter;
};

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>
): TransactionFilters {
  const period =
    searchParams.period === "previous" || searchParams.period === "custom"
      ? searchParams.period
      : "current";

  const type =
    searchParams.type === "ENTRADA" ||
    searchParams.type === "SAIDA" ||
    searchParams.type === "NEUTRO"
      ? searchParams.type
      : "all";

  const classification =
    typeof searchParams.classification === "string" &&
    (Object.values(Classification) as string[]).includes(searchParams.classification)
      ? (searchParams.classification as Classification)
      : "all";

  const categoryId =
    typeof searchParams.categoryId === "string" && searchParams.categoryId
      ? searchParams.categoryId
      : undefined;

  const from = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const to = typeof searchParams.to === "string" ? searchParams.to : undefined;

  const status =
    searchParams.status === "PAGO" || searchParams.status === "NAO_PAGO"
      ? searchParams.status
      : "all";

  return { period, from, to, type, categoryId, classification, status };
}

function resolveDateRange(filters: TransactionFilters): { from: Date; to: Date } {
  if (filters.period === "previous") {
    return previousMonthRange();
  }

  if (filters.period === "custom") {
    const from = filters.from ? parseDateInputValue(filters.from) : null;
    const to = filters.to ? parseDateInputValue(filters.to) : null;
    if (from && to) {
      const toExclusive = new Date(to);
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
      return { from, to: toExclusive };
    }
    // Incomplete custom range: fall back to the current month.
    return currentMonthRange();
  }

  return currentMonthRange();
}

export type TransactionWithCategory = Awaited<
  ReturnType<typeof getTransactions>
>[number];

export async function getTransactions(userId: string, filters: TransactionFilters) {
  const { from, to } = resolveDateRange(filters);

  return prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: from, lt: to },
      ...(filters.type !== "all" ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.classification !== "all"
        ? { classification: filters.classification }
        : {}),
      ...(filters.status !== "all" ? { status: filters.status } : {}),
    },
    include: {
      category: { select: { name: true } },
      paymentMethod: { select: { name: true } },
      tag: { select: { name: true } },
      series: { select: { seriesType: true, installmentCount: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export type TransactionsSummary = {
  incomeCents: number;
  expenseCents: number;
  neutroCents: number;
  balanceCents: number;
};

// Neutro is neither income nor expense (a bill payment, a reimbursement,
// a transfer between your own accounts) — it's tracked in its own
// bucket and deliberately left out of balanceCents, otherwise it would
// misrepresent the actual Entradas/Saídas/Saldo.
export function summarize(
  transactions: { type: TransactionType; amountCents: number }[]
): TransactionsSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let neutroCents = 0;

  for (const t of transactions) {
    if (t.type === "ENTRADA") {
      incomeCents += t.amountCents;
    } else if (t.type === "SAIDA") {
      expenseCents += t.amountCents;
    } else {
      neutroCents += t.amountCents;
    }
  }

  return {
    incomeCents,
    expenseCents,
    neutroCents,
    balanceCents: incomeCents - expenseCents,
  };
}

export async function getCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { order: "asc" }],
  });
}

export async function getPaymentMethods(userId: string) {
  return prisma.paymentMethod.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function getTags(userId: string) {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}
