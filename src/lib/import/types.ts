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
  suggestedPaymentMethodId: string | null;
  suggestedPaymentMethodName: string | null;
  suggestedTagId: string | null;
  possibleDuplicateOfId: string | null;
  parseWarnings: string[];
};

export type ParseResult =
  | { rows: ParsedTransactionRow[]; error?: undefined }
  | { rows?: undefined; error: string };
