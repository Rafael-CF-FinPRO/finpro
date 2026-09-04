import { prisma } from "@/lib/prisma";
import { addMonthsClamped } from "@/lib/dates";
import type {
  Classification,
  PaymentMethod,
  Tag,
  Transaction,
  TransactionSeries,
} from "@/generated/prisma/client";
import type { TransactionStatus, TransactionType } from "@/generated/prisma/enums";

// How far ahead an open-ended (no endDate) recurring series is kept
// materialized. Re-applied on every Lançamentos page load via
// ensureRecurringOccurrences — no cron needed, the window just stays
// full as long as the user visits the page at least this often.
const HORIZON_MONTHS = 3;

/** The one rule for every generated occurrence (recurring or
 * installment): already-due dates are real (Pago), future ones are a
 * prediction (Não pago). Applied per-date, not just to the first
 * occurrence, so a series backdated into the past comes out with its
 * overdue dates correctly marked Pago and only the future ones Não
 * pago — see Teste 6/8 of the spec. */
export function computeOccurrenceStatus(date: Date, today: Date = new Date()): TransactionStatus {
  return date <= today ? "PAGO" : "NAO_PAGO";
}

type OccurrenceRow = {
  userId: string;
  type: TransactionType;
  amountCents: number;
  description: string | null;
  categoryId: string;
  classification: Classification;
  paymentMethodId: string | null;
  tagId: string | null;
  note: string | null;
  date: Date;
  status: TransactionStatus;
  seriesId: string;
  installmentNumber: number | null;
};

function baseRowFromSeries(
  series: TransactionSeries,
  date: Date,
  installmentNumber: number | null,
  today: Date
): OccurrenceRow {
  return {
    userId: series.userId,
    type: series.type,
    amountCents: series.amountCents,
    description: series.description,
    categoryId: series.categoryId,
    classification: series.classification,
    paymentMethodId: series.paymentMethodId,
    tagId: series.tagId,
    note: series.note,
    date,
    status: computeOccurrenceStatus(date, today),
    seriesId: series.id,
    installmentNumber,
  };
}

/** All installments of a PARCELADO series at once — finite and fully
 * known up front, unlike recurring occurrences. Every installment
 * carries the exact same amountCents (the parcela value the user
 * typed) — the total shown in the UI is just amountCents *
 * installmentCount, never stored separately, so there is no cents
 * division to get wrong (Teste 4/5 of the spec). */
export function buildInstallmentRows(series: TransactionSeries, today: Date = new Date()): OccurrenceRow[] {
  if (series.seriesType !== "PARCELADO" || !series.installmentCount) return [];
  return Array.from({ length: series.installmentCount }, (_, i) =>
    baseRowFromSeries(series, addMonthsClamped(series.startDate, i), i + 1, today)
  );
}

/** Recurring occurrences from `series.startDate` up to whichever comes
 * first: `series.endDate`, or `horizonDate`. Used both at creation
 * (first batch) and by ensureRecurringOccurrences (top-up), which
 * passes a later starting cursor so already-generated dates are never
 * duplicated. */
function buildRecurringRows(
  series: TransactionSeries,
  fromDate: Date,
  horizonDate: Date,
  today: Date
): OccurrenceRow[] {
  if (series.seriesType !== "RECORRENTE") return [];
  const rows: OccurrenceRow[] = [];
  let cursor = fromDate;
  while (cursor <= horizonDate && (!series.endDate || cursor <= series.endDate)) {
    rows.push(baseRowFromSeries(series, cursor, null, today));
    cursor = addMonthsClamped(cursor, 1);
  }
  return rows;
}

/** The initial batch of recurring occurrences generated right when the
 * series is created — from startDate up to the standard horizon (or
 * endDate, if sooner). */
export function buildInitialRecurringRows(series: TransactionSeries, today: Date = new Date()): OccurrenceRow[] {
  const horizonDate = addMonthsClamped(today, HORIZON_MONTHS);
  return buildRecurringRows(series, series.startDate, horizonDate, today);
}

/** Tops up every active RECORRENTE series belonging to `userId` so its
 * generated occurrences always reach at least `today + HORIZON_MONTHS`
 * months — called from the Lançamentos page load, before
 * getTransactions, so newly-materialized rows show up immediately.
 * Always advances from `series.generatedUntil`, never from
 * MAX(Transaction.date) — the latter would make deleting the single
 * latest occurrence ("somente este") get silently regenerated on the
 * very next page load, since nothing would exist past that point
 * anymore. generatedUntil only ever moves forward, independent of
 * which generated rows the user has since deleted. */
export async function ensureRecurringOccurrences(userId: string): Promise<void> {
  const activeSeries = await prisma.transactionSeries.findMany({
    where: { userId, seriesType: "RECORRENTE", isActive: true },
  });
  if (activeSeries.length === 0) return;

  const today = new Date();
  const horizonDate = addMonthsClamped(today, HORIZON_MONTHS);

  for (const series of activeSeries) {
    const cursorStart = series.generatedUntil ?? series.startDate;
    const fromDate = series.generatedUntil ? addMonthsClamped(cursorStart, 1) : cursorStart;
    if (fromDate > horizonDate) continue;
    const rows = buildRecurringRows(series, fromDate, horizonDate, today);
    if (rows.length > 0) {
      // skipDuplicates: two concurrent page loads can both read the
      // same generatedUntil before either writes it back — the
      // (seriesId, date) unique constraint plus this makes the loser
      // of that race a harmless no-op instead of a duplicate row.
      await prisma.transaction.createMany({ data: rows, skipDuplicates: true });
      await prisma.transactionSeries.update({
        where: { id: series.id },
        data: { generatedUntil: rows[rows.length - 1].date },
      });
    }
  }
}

export type SeriesWithRefs = TransactionSeries & {
  category: { name: string };
  paymentMethod: PaymentMethod | null;
  tag: Tag | null;
};

export type TransactionWithSeries = Transaction & {
  series: (TransactionSeries & { category: { name: string } }) | null;
};

/** "Parcela 4/12" — the discreet listing annotation for an installment
 * occurrence. Null for anything else (recurring, or no series). */
export function installmentLabel(transaction: TransactionWithSeries): string | null {
  if (!transaction.series || transaction.series.seriesType !== "PARCELADO") return null;
  if (transaction.installmentNumber === null || !transaction.series.installmentCount) return null;
  return `Parcela ${transaction.installmentNumber}/${transaction.series.installmentCount}`;
}
