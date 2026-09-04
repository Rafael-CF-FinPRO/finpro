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

// Payment method only — category suggestion is no longer decided here.
// It used to run a weak substring fallback automatically at parse time;
// now the whole category-suggestion pipeline (history, global
// knowledge, AI, research) is on-demand only, triggered by the
// "Categorizar com IA" button (src/lib/import/merchant-resolver.ts),
// never automatically during import.
export function enrichRowsWithSuggestions(
  rows: ParsedTransactionRow[],
  context: { paymentMethods: MatchSimpleOption[] }
): ParsedTransactionRow[] {
  return rows.map((row) => ({
    ...row,
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
