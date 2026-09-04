import { prisma } from "@/lib/prisma";
import { parseDateInputValue } from "@/lib/dates";
import type { ParsedTransactionRow } from "./types";
import type { Classification, TransactionType } from "@/generated/prisma/enums";

export type MatchCategory = {
  id: string;
  name: string;
  type: TransactionType;
  classification: Classification;
  isActive: boolean;
};
export type MatchSimpleOption = { id: string; name: string };

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Deliberately weak — this app has no merchant/keyword classification
// system (src/lib/default-categories.ts is only a starter seed, not a
// mapping table). A substring match against the user's own category
// names is just a starting point; every row is still reviewed and
// editable before import (see ImportReviewTable.tsx).
function suggestCategoryId(
  description: string,
  categories: MatchCategory[],
  type: ParsedTransactionRow["type"]
): string | null {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) return null;
  const match = categories.find(
    (c) => c.type === type && c.isActive && normalizedDescription.includes(normalizeText(c.name))
  );
  return match?.id ?? null;
}

// OFX/PDF statements rarely state a payment method per line (it's
// implicit in which account the statement belongs to) — this only finds
// a match when the description happens to name one directly, which is
// uncommon but harmless to attempt.
function suggestPaymentMethodId(description: string, paymentMethods: MatchSimpleOption[]): string | null {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) return null;
  const match = paymentMethods.find((pm) => normalizedDescription.includes(normalizeText(pm.name)));
  return match?.id ?? null;
}

export function enrichRowsWithSuggestions(
  rows: ParsedTransactionRow[],
  context: { categories: MatchCategory[]; paymentMethods: MatchSimpleOption[] }
): ParsedTransactionRow[] {
  return rows.map((row) => ({
    ...row,
    suggestedCategoryId:
      row.suggestedCategoryId ?? suggestCategoryId(row.description, context.categories, row.type),
    suggestedPaymentMethodId:
      row.suggestedPaymentMethodId ?? suggestPaymentMethodId(row.description, context.paymentMethods),
  }));
}

// Flags a row as a likely duplicate when an existing transaction shares
// the exact same date + amount + type — a heuristic, not a guarantee
// (no dedup/external-id field exists on Transaction). Flagged rows
// default to unchecked in the review table but stay fully includable,
// since two genuinely identical same-day transactions are possible.
export async function flagPossibleDuplicates(
  userId: string,
  rows: ParsedTransactionRow[]
): Promise<ParsedTransactionRow[]> {
  const validDates = rows.map((r) => parseDateInputValue(r.date)).filter((d): d is Date => d !== null);
  if (validDates.length === 0) return rows;

  const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));

  const existing = await prisma.transaction.findMany({
    where: { userId, date: { gte: minDate, lte: maxDate } },
    select: { id: true, date: true, amountCents: true, type: true },
  });

  return rows.map((row) => {
    const rowDate = parseDateInputValue(row.date);
    if (!rowDate) return row;
    const duplicate = existing.find(
      (t) =>
        t.type === row.type &&
        t.amountCents === row.amountCents &&
        t.date.getTime() === rowDate.getTime()
    );
    return duplicate ? { ...row, possibleDuplicateOfId: duplicate.id } : row;
  });
}
