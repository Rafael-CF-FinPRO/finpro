import { prisma } from "@/lib/prisma";
import { parseDateInputValue } from "@/lib/dates";
import { normalizeMerchantText } from "./text-normalize";
import type { ParsedTransactionRow } from "./types";
import type { SuggestionConfidence } from "@/lib/transaction-labels";

// Outer bound for even considering a pending occurrence as a candidate
// — a "strong" match (date-wise) is much tighter, this is just the
// widest net cast before giving up entirely.
const DATE_WINDOW_DAYS = 15;
const DATE_STRONG_DAYS = 5;
const AMOUNT_STRONG_TOLERANCE = 0.1;
const AMOUNT_LOOSE_TOLERANCE = 0.25;
// Jaccard token-overlap floor for description alone to count as a
// (weak, MEDIUM-only) signal — bank statement text rarely matches a
// user-typed bill name well, so this stays low and is never enough on
// its own to reach HIGH.
const DESCRIPTION_MIN_SIMILARITY = 0.34;

type PendingCandidate = {
  id: string;
  date: Date;
  amountCents: number;
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
  categoryId: string;
  description: string | null;
  externalId: string | null;
  seriesType: "RECORRENTE" | "PARCELADO" | null;
  installmentNumber: number | null;
  installmentCount: number | null;
};

function tokenize(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((t) => t.length >= 3));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

// Recognizes a Brazilian card-statement installment marker like
// "04/12" or "COMPRA PARC 04/12" in an imported description, returning
// [current, total] when found — a near-certain signal when it lines up
// with a specific pending parcela's own number/count.
function detectInstallmentMarker(description: string): [number, number] | null {
  const match = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/.exec(description);
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (current < 1 || total < current || total > 360) return null;
  return [current, total];
}

// Ranks candidates within AND across confidence tiers, so that when
// two candidates both reach HIGH (e.g. a coincidentally close-amount
// recurring bill and the actual correct parcela match by installment
// marker), the more specific signal wins the tie instead of whichever
// happened to be iterated first — externalId is the most authoritative
// signal, then a recognized installment marker, then date+amount
// proximity, then everything else.
const SPECIFICITY = {
  externalId: 100,
  installmentMarker: 90,
  dateAndAmountStrong: 80,
  categoryBoost: 75,
  dateOrAmountStrong: 50,
  descriptionOnly: 40,
} as const;

// Never decides on amount alone (section 15 of the spec) — combines
// external id, date proximity, amount proximity, category agreement,
// description similarity, and installment-number recognition. Returns
// null (never "LOW") when nothing clears even the loose thresholds —
// "don't associate" is represented by no match, not a low-confidence one.
function scoreCandidate(
  row: ParsedTransactionRow,
  rowDate: Date,
  candidate: PendingCandidate
): { confidence: SuggestionConfidence; reason: string; specificity: number } | null {
  if (candidate.type !== row.type) return null;

  if (row.externalId && candidate.externalId && row.externalId === candidate.externalId) {
    return {
      confidence: "HIGH",
      reason: "Mesmo identificador do banco do lançamento previsto.",
      specificity: SPECIFICITY.externalId,
    };
  }

  const dayDiff = Math.abs(rowDate.getTime() - candidate.date.getTime()) / 86_400_000;
  if (dayDiff > DATE_WINDOW_DAYS) return null;

  const amountDiff = Math.abs(row.amountCents - candidate.amountCents) / Math.max(candidate.amountCents, 1);
  if (amountDiff > AMOUNT_LOOSE_TOLERANCE) return null;

  const installmentMarker = detectInstallmentMarker(row.description);
  if (
    candidate.seriesType === "PARCELADO" &&
    candidate.installmentNumber !== null &&
    candidate.installmentCount !== null &&
    installmentMarker &&
    installmentMarker[0] === candidate.installmentNumber &&
    installmentMarker[1] === candidate.installmentCount
  ) {
    return {
      confidence: "HIGH",
      reason: `Corresponde à parcela ${candidate.installmentNumber}/${candidate.installmentCount} prevista.`,
      specificity: SPECIFICITY.installmentMarker,
    };
  }

  const dateStrong = dayDiff <= DATE_STRONG_DAYS;
  const amountStrong = amountDiff <= AMOUNT_STRONG_TOLERANCE;
  const categoryMatches = row.suggestedCategoryId !== null && row.suggestedCategoryId === candidate.categoryId;

  if (dateStrong && amountStrong) {
    return {
      confidence: "HIGH",
      reason: "Data e valor muito próximos do lançamento previsto.",
      specificity: SPECIFICITY.dateAndAmountStrong,
    };
  }
  if (categoryMatches && (dateStrong || amountStrong)) {
    return {
      confidence: "HIGH",
      reason: "Mesma categoria e data ou valor próximos do previsto.",
      specificity: SPECIFICITY.categoryBoost,
    };
  }
  if (dateStrong || amountStrong) {
    return {
      confidence: "MEDIUM",
      reason: "Data ou valor parecidos com um lançamento previsto — confira antes de confirmar.",
      specificity: SPECIFICITY.dateOrAmountStrong,
    };
  }

  const descSimilarity = jaccard(
    tokenize(normalizeMerchantText(row.description)),
    tokenize(normalizeMerchantText(candidate.description ?? ""))
  );
  if (descSimilarity >= DESCRIPTION_MIN_SIMILARITY) {
    return {
      confidence: "MEDIUM",
      reason: "Descrição parecida com um lançamento previsto — confira antes de confirmar.",
      specificity: SPECIFICITY.descriptionOnly,
    };
  }

  return null;
}

// Matches imported rows against the user's own pending (NAO_PAGO)
// recurring/installment occurrences — the "baixa inteligente" that
// avoids creating a duplicate when a predicted bill actually shows up
// in a statement. A HIGH match pre-selects "dar baixa" in the review
// table (still requires the final "Confirmar importação" click, same
// as every other suggestion in this app); MEDIUM is presented for
// review, unselected; anything weaker (no match) imports normally.
// Each pending occurrence is claimed by at most one row per batch.
export async function matchPendingOccurrences(
  userId: string,
  rows: ParsedTransactionRow[]
): Promise<ParsedTransactionRow[]> {
  const validDates = rows.map((r) => parseDateInputValue(r.date)).filter((d): d is Date => d !== null);
  if (validDates.length === 0) return rows;

  const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
  minDate.setUTCDate(minDate.getUTCDate() - DATE_WINDOW_DAYS);
  const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
  maxDate.setUTCDate(maxDate.getUTCDate() + DATE_WINDOW_DAYS);

  const candidates = await prisma.transaction.findMany({
    where: { userId, status: "NAO_PAGO", date: { gte: minDate, lte: maxDate } },
    select: {
      id: true,
      date: true,
      amountCents: true,
      type: true,
      categoryId: true,
      description: true,
      externalId: true,
      installmentNumber: true,
      series: { select: { seriesType: true, installmentCount: true } },
    },
  });
  if (candidates.length === 0) return rows;

  const pending: PendingCandidate[] = candidates.map((c) => ({
    id: c.id,
    date: c.date,
    amountCents: c.amountCents,
    type: c.type,
    categoryId: c.categoryId,
    description: c.description,
    externalId: c.externalId,
    seriesType: c.series?.seriesType ?? null,
    installmentNumber: c.installmentNumber,
    installmentCount: c.series?.installmentCount ?? null,
  }));

  const usedCandidateIds = new Set<string>();

  return rows.map((row) => {
    const rowDate = parseDateInputValue(row.date);
    if (!rowDate) return row;

    let best:
      | { candidate: PendingCandidate; confidence: SuggestionConfidence; reason: string; specificity: number }
      | null = null;
    for (const candidate of pending) {
      if (usedCandidateIds.has(candidate.id)) continue;
      const scored = scoreCandidate(row, rowDate, candidate);
      if (!scored) continue;
      if (!best || scored.specificity > best.specificity) {
        best = { candidate, ...scored };
      }
    }

    if (!best) return row;

    usedCandidateIds.add(best.candidate.id);
    const installmentLabel =
      best.candidate.seriesType === "PARCELADO" &&
      best.candidate.installmentNumber !== null &&
      best.candidate.installmentCount
        ? `Parcela ${best.candidate.installmentNumber}/${best.candidate.installmentCount}`
        : null;

    return {
      ...row,
      matchedPendingTransactionId: best.candidate.id,
      matchConfidence: best.confidence,
      matchReason: best.reason,
      matchInstallmentLabel: installmentLabel,
    };
  });
}
