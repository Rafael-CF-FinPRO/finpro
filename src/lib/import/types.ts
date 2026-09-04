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
};

export type ParseResult =
  | { rows: ParsedTransactionRow[]; warning?: string; error?: undefined }
  | { rows?: undefined; warning?: undefined; error: string };
