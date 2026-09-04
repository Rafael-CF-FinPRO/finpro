import type { ParseResult, ParsedTransactionRow } from "./types";

const STMTTRN_BLOCK = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;

function field(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^\\r\\n<]+)`, "i").exec(block);
  return match ? match[1].trim() : null;
}

// Brazilian bank OFX exports are frequently Latin-1/Windows-1252, not
// UTF-8 — decoding as UTF-8 first and checking for the replacement
// character is a simple, reliable way to detect that without having to
// trust (or parse) the file's own CHARSET/ENCODING header, which in
// practice is inconsistently set across banks.
function decodeOfxBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString("utf-8");
  return utf8.includes("�") ? buffer.toString("latin1") : utf8;
}

function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null;
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(raw);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

export function parseOfxFile(buffer: Buffer): ParseResult {
  const text = decodeOfxBuffer(buffer);
  const rows: ParsedTransactionRow[] = [];
  const seenFitIds = new Set<string>();

  for (const match of text.matchAll(STMTTRN_BLOCK)) {
    const block = match[1];

    const fitId = field(block, "FITID");
    if (fitId) {
      if (seenFitIds.has(fitId)) continue;
      seenFitIds.add(fitId);
    }

    const date = parseOfxDate(field(block, "DTPOSTED"));
    const amountRaw = field(block, "TRNAMT");
    const amount = amountRaw ? Number.parseFloat(amountRaw) : NaN;
    if (!date || !Number.isFinite(amount)) continue;

    const trnType = field(block, "TRNTYPE");
    const type: ParsedTransactionRow["type"] =
      amount !== 0 ? (amount < 0 ? "SAIDA" : "ENTRADA") : trnType === "DEBIT" ? "SAIDA" : "ENTRADA";

    const description = field(block, "MEMO") ?? field(block, "NAME") ?? "";

    rows.push({
      rowId: crypto.randomUUID(),
      date,
      description,
      amountCents: Math.round(Math.abs(amount) * 100),
      type,
      rawText: block.replace(/\s+/g, " ").trim(),
      suggestedCategoryId: null,
      suggestedCategorySource: null,
      suggestedCategoryReason: null,
      suggestedPaymentMethodId: null,
      suggestedPaymentMethodName: null,
      suggestedTagId: null,
      possibleDuplicateOfId: null,
      parseWarnings: [],
      externalId: fitId,
      matchedPendingTransactionId: null,
      matchConfidence: null,
      matchReason: null,
      matchInstallmentLabel: null,
    });
  }

  if (rows.length === 0) {
    return { error: "Não foram encontrados lançamentos neste arquivo OFX." };
  }

  return { rows };
}
