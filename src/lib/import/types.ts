import type { SuggestionConfidence, SuggestionSource } from "@/lib/transaction-labels";

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
  // Set directly by the spreadsheet parser when its own "Categoria"
  // column resolves ("USER" — the user's own explicit input, not an
  // inference); left null by OFX/PDF and by the spreadsheet parser when
  // it has no category column value. Everything else is only ever set
  // by the on-demand categorizer (src/lib/import/merchant-resolver.ts),
  // triggered by the "Categorizar com IA" button — never automatically
  // during parsing. Traceability only; never a stand-in for review.
  suggestedCategorySource: SuggestionSource | null;
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
