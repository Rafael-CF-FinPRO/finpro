import { prisma } from "@/lib/prisma";
import { parseDateInputValue } from "@/lib/dates";
import { normalizeText } from "./text-normalize";
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

// This substring heuristic is now the LAST-RESORT fallback behind the
// AI/history categorization layer (src/lib/import/ai-categorization.ts),
// not the primary source — it only fires for a row when that layer
// never rendered any opinion at all (suggestedCategoryConfidence still
// null, meaning it was skipped or the whole call failed). If the AI
// layer deliberately returned "I don't know" (confidence LOW), that
// must NOT be overwritten by a weaker guess here.
export function enrichRowsWithSuggestions(
  rows: ParsedTransactionRow[],
  context: { categories: MatchCategory[]; paymentMethods: MatchSimpleOption[] }
): ParsedTransactionRow[] {
  return rows.map((row) => ({
    ...row,
    suggestedCategoryId:
      row.suggestedCategoryId ??
      (row.suggestedCategoryConfidence === null
        ? suggestCategoryId(row.description, context.categories, row.type)
        : null),
    suggestedPaymentMethodId:
      row.suggestedPaymentMethodId ?? suggestPaymentMethodId(row.description, context.paymentMethods),
  }));
}

// Flags a row as a likely duplicate of an already-realized transaction
// — either the same externalId (an exact re-import of the same bank
// movement, when the source provides one) or, failing that, the same
// date + amount + type. Only compares against status: "PAGO" rows —
// a NAO_PAGO one is a pending prediction, not a duplicate; matching a
// row against those is matchPendingOccurrences's job (src/lib/import/
// reconciliation.ts), a different outcome (baixa, not "skip as dupe").
// Flagged rows default to unchecked in the review table but stay fully
// includable, since two genuinely identical same-day transactions are
// possible.
export async function flagPossibleDuplicates(
  userId: string,
  rows: ParsedTransactionRow[]
): Promise<ParsedTransactionRow[]> {
  const validDates = rows.map((r) => parseDateInputValue(r.date)).filter((d): d is Date => d !== null);
  if (validDates.length === 0) return rows;

  const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));

  const existing = await prisma.transaction.findMany({
    where: { userId, status: "PAGO", date: { gte: minDate, lte: maxDate } },
    select: { id: true, date: true, amountCents: true, type: true, externalId: true },
  });

  return rows.map((row) => {
    const rowDate = parseDateInputValue(row.date);
    if (!rowDate) return row;
    const duplicate =
      (row.externalId ? existing.find((t) => t.externalId === row.externalId) : undefined) ??
      existing.find(
        (t) =>
          t.type === row.type &&
          t.amountCents === row.amountCents &&
          t.date.getTime() === rowDate.getTime()
      );
    return duplicate ? { ...row, possibleDuplicateOfId: duplicate.id } : row;
  });
}
