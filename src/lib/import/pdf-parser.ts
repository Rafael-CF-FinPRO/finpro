import { PDFParse } from "pdf-parse";
import { parseMoneyToCents } from "@/lib/money";
import type { ParseResult, ParsedTransactionRow } from "./types";

const DATE_PATTERN = /(\d{2})\/(\d{2})\/(\d{2,4})/;
const AMOUNT_PATTERN = /(-)?\s?(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})\s?(D|C)?\b/;

function toIsoDate(match: RegExpExecArray): string | null {
  const [, day, month, yearRaw] = match;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractAmount(
  line: string
): { amountCents: number; type: ParsedTransactionRow["type"]; matchText: string } | null {
  const match = AMOUNT_PATTERN.exec(line);
  if (!match) return null;
  const [full, negativeSign, numberPart, suffix] = match;
  const cents = parseMoneyToCents(numberPart);
  if (cents === null) return null;
  const isNegative = Boolean(negativeSign) || suffix === "D";
  return { amountCents: cents, type: isNegative ? "SAIDA" : "ENTRADA", matchText: full };
}

// Bank statement PDFs have no fixed layout — this is a generic
// date+amount line-pairing heuristic, not a bank-specific template. It
// will miss or misparse rows for many real statements; that's expected
// and acceptable because every row goes through the mandatory review
// table (src/components/importar/ImportReviewTable.tsx) before anything
// is written to the database.
export async function parsePdfBuffer(buffer: Buffer): Promise<ParseResult> {
  const parser = new PDFParse({ data: buffer });
  let text: string;
  try {
    const result = await parser.getText();
    text = result.text;
  } finally {
    await parser.destroy();
  }

  if (!text || !text.trim()) {
    return { error: "Não foi possível ler texto deste PDF — tente OFX ou a planilha." };
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: ParsedTransactionRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = DATE_PATTERN.exec(line);
    if (!dateMatch) continue;
    const date = toIsoDate(dateMatch);
    if (!date) continue;

    let amount = extractAmount(line);
    const sourceLines = [line];
    if (!amount && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      amount = extractAmount(nextLine);
      if (amount) sourceLines.push(nextLine);
    }
    if (!amount) continue;

    let description = line
      .replace(dateMatch[0], "")
      .replace(amount.matchText, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!description && sourceLines.length > 1) {
      description = sourceLines[1].replace(amount.matchText, "").replace(/\s{2,}/g, " ").trim();
    }

    rows.push({
      rowId: crypto.randomUUID(),
      date,
      description,
      amountCents: amount.amountCents,
      type: amount.type,
      rawText: sourceLines.join(" | "),
      suggestedCategoryId: null,
      suggestedCategorySource: null,
      suggestedCategoryReason: null,
      suggestedPaymentMethodId: null,
      suggestedPaymentMethodName: null,
      suggestedTagId: null,
      possibleDuplicateOfId: null,
      parseWarnings: ["Extraído automaticamente de PDF — confira os dados antes de importar."],
      externalId: null,
      matchedPendingTransactionId: null,
      matchConfidence: null,
      matchReason: null,
      matchInstallmentLabel: null,
    });
  }

  if (rows.length === 0) {
    return { error: "Não foi possível identificar lançamentos neste PDF. Tente OFX ou a planilha." };
  }

  return { rows };
}
