import type { SuggestionConfidence } from "@/lib/transaction-labels";

export type ImportSource = "OFX" | "PDF" | "SPREADSHEET";

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

/** One candidate transaction produced by a parser, before the user has
 * reviewed/edited it — nothing here has been written to the database yet. */
export type ParsedTransactionRow = {
  rowId: string;
  date: string;
  description: string;
  amountCents: number;
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
  rawText: string;
  suggestedCategoryId: string | null;
  // null until the AI/history categorization layer (src/lib/import/
  // ai-categorization.ts) has actually run and produced an opinion for
  // this row — distinct from a deliberate "I don't know" (LOW), which
  // still sets these. Lets the fallback substring heuristic in
  // matching.ts tell "AI never ran" apart from "AI declined to guess".
  suggestedCategoryConfidence: SuggestionConfidence | null;
  suggestedCategoryReason: string | null;
  suggestedPaymentMethodId: string | null;
  suggestedPaymentMethodName: string | null;
  suggestedTagId: string | null;
  possibleDuplicateOfId: string | null;
  parseWarnings: string[];
  // The source's own unique id for this movement — OFX FITID today,
  // always null for PDF/spreadsheet. Persisted onto Transaction.externalId
  // when the row is committed; used both to recognize an exact re-import
  // and, more importantly, as the strongest signal when matching against
  // a pending series occurrence (see src/lib/import/reconciliation.ts).
  externalId: string | null;
  // Set by matchPendingOccurrences when this row appears to correspond
  // to a NAO_PAGO recurring/installment occurrence already on record —
  // "dar baixa" instead of creating a new transaction. null means no
  // candidate cleared even the loose thresholds (import as new, as
  // usual). Independent of suggestedCategoryId/possibleDuplicateOfId.
  matchedPendingTransactionId: string | null;
  matchConfidence: SuggestionConfidence | null;
  matchReason: string | null;
  matchInstallmentLabel: string | null;
};

export type ParseResult =
  | { rows: ParsedTransactionRow[]; warning?: string; error?: undefined }
  | { rows?: undefined; warning?: undefined; error: string };
