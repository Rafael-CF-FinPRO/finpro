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
/** "NORMAL" means the transaction has no series at all (seriesId is
 * null) — the other two mirror SeriesType directly. Not itself a
 * Prisma enum since "no series" isn't a value that column ever holds. */
export type LancamentoKind = "NORMAL" | "RECORRENTE" | "PARCELADO";
const LANCAMENTO_KINDS: LancamentoKind[] = ["NORMAL", "RECORRENTE", "PARCELADO"];

export type TransactionFilters = {
  period: PeriodFilter;
  from?: string;
  to?: string;
  type: TypeFilter;
  categoryId?: string;
  classification: ClassificationFilter;
  status: StatusFilter;
  /** Empty array means "no filter" (show all), same convention as the
   * "all"/undefined defaults above — never an actual empty-result
   * request. */
  tagIds: string[];
  paymentMethodIds: string[];
  kinds: LancamentoKind[];
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

  // Multi-select filters are encoded as one comma-joined param (not
  // repeated params) so URLSearchParams.set/get stays a simple 1:1
  // key-value API on the client side — see FiltersBar.tsx.
  const tagIds = parseCommaList(searchParams.tagIds);
  const paymentMethodIds = parseCommaList(searchParams.paymentMethodIds);
  const kinds = parseCommaList(searchParams.kinds).filter((k): k is LancamentoKind =>
    LANCAMENTO_KINDS.includes(k as LancamentoKind)
  );

  return { period, from, to, type, categoryId, classification, status, tagIds, paymentMethodIds, kinds };
}

function parseCommaList(value: string | string[] | undefined): string[] {
  if (typeof value !== "string" || value === "") return [];
  return value.split(",").filter(Boolean);
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
  const seriesKinds = filters.kinds.filter(
    (k): k is Extract<LancamentoKind, "RECORRENTE" | "PARCELADO"> => k !== "NORMAL"
  );

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
      ...(filters.tagIds.length > 0 ? { tagId: { in: filters.tagIds } } : {}),
      ...(filters.paymentMethodIds.length > 0
        ? { paymentMethodId: { in: filters.paymentMethodIds } }
        : {}),
      // All 3 kinds selected is the same as none selected (no filter) —
      // only build the OR once it actually excludes something.
      ...(filters.kinds.length > 0 && filters.kinds.length < 3
        ? {
            OR: [
              ...(filters.kinds.includes("NORMAL") ? [{ seriesId: null }] : []),
              ...(seriesKinds.length > 0 ? [{ series: { seriesType: { in: seriesKinds } } }] : []),
            ],
          }
        : {}),
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
  incomePaidCents: number;
  incomeUnpaidCents: number;
  expenseCents: number;
  expensePaidCents: number;
  expenseUnpaidCents: number;
  neutroCents: number;
  neutroPaidCents: number;
  neutroUnpaidCents: number;
  balanceCents: number;
  balancePaidCents: number;
  balanceUnpaidCents: number;
};

// Neutro is neither income nor expense (a bill payment, a reimbursement,
// a transfer between your own accounts) — it's tracked in its own
// bucket and deliberately left out of balanceCents, otherwise it would
// misrepresent the actual Entradas/Saídas/Saldo. Each bucket (and the
// derived Saldo) also splits into its Pago/Não pago share, so the
// summary cards can show how much of each total is already settled vs
// still pending.
export function summarize(
  transactions: { type: TransactionType; amountCents: number; status: TransactionStatus }[]
): TransactionsSummary {
  let incomeCents = 0;
  let incomePaidCents = 0;
  let expenseCents = 0;
  let expensePaidCents = 0;
  let neutroCents = 0;
  let neutroPaidCents = 0;

  for (const t of transactions) {
    const isPaid = t.status === "PAGO";
    if (t.type === "ENTRADA") {
      incomeCents += t.amountCents;
      if (isPaid) incomePaidCents += t.amountCents;
    } else if (t.type === "SAIDA") {
      expenseCents += t.amountCents;
      if (isPaid) expensePaidCents += t.amountCents;
    } else {
      neutroCents += t.amountCents;
      if (isPaid) neutroPaidCents += t.amountCents;
    }
  }

  const incomeUnpaidCents = incomeCents - incomePaidCents;
  const expenseUnpaidCents = expenseCents - expensePaidCents;

  return {
    incomeCents,
    incomePaidCents,
    incomeUnpaidCents,
    expenseCents,
    expensePaidCents,
    expenseUnpaidCents,
    neutroCents,
    neutroPaidCents,
    neutroUnpaidCents: neutroCents - neutroPaidCents,
    balanceCents: incomeCents - expenseCents,
    balancePaidCents: incomePaidCents - expensePaidCents,
    balanceUnpaidCents: incomeUnpaidCents - expenseUnpaidCents,
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
