// Shared by matching.ts, spreadsheet-parser.ts, and the AI categorization
// layer (history.ts / ai-categorization.ts) — a single normalization
// implementation instead of copies drifting apart.
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Bank/card statement descriptions append store numbers, auth codes, or
// order ids that make otherwise-identical merchants look unique
// ("UBER *TRIP 00234" vs "UBER *TRIP 07711") — this strips that noise so
// repeat merchants collapse to the same history key. Deliberately not
// used for the spreadsheet parser's category-name matching (that one
// needs exact, not fuzzy, matching against known category names) — only
// for merchant/description text feeding the categorization history.
export function normalizeMerchantText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[*#]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+\d{1,2}\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
