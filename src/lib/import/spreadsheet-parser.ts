import * as XLSX from "@e965/xlsx";
import { parseMoneyToCents } from "@/lib/money";
import { withCategoryDisplayName } from "@/lib/category-display";
import { normalizeText } from "./text-normalize";
import type { ParseResult, ParsedTransactionRow } from "./types";
import type { Classification, TransactionType } from "@/generated/prisma/enums";

export type SpreadsheetCategory = {
  id: string;
  name: string;
  type: TransactionType;
  classification: Classification;
  isActive: boolean;
};
export type SpreadsheetSimpleOption = { id: string; name: string };

type RawRow = {
  date?: unknown;
  type?: unknown;
  amount?: unknown;
  category?: unknown;
  description?: unknown;
  paymentMethod?: unknown;
  tag?: unknown;
  note?: unknown;
};

// Header matching is case/accent/whitespace-insensitive and doesn't
// assume a fixed column order — a user may have reordered columns in
// Excel after downloading the template.
const HEADER_KEYS: Record<string, keyof RawRow> = {
  data: "date",
  tipo: "type",
  valor: "amount",
  categoria: "category",
  descricao: "description",
  "meio de pagamento": "paymentMethod",
  tag: "tag",
  observacao: "note",
};

function parseTemplateDate(value: unknown): string | null {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(value ?? "").trim();
  if (!str) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (iso) return str;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(str);
  if (br) {
    const [, day, month, yearRaw] = br;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

function parseTemplateAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string") return parseMoneyToCents(value);
  return null;
}

function parseTemplateType(value: unknown): "ENTRADA" | "SAIDA" | "NEUTRO" | null {
  const normalized = normalizeText(String(value ?? ""));
  if (normalized === "entrada") return "ENTRADA";
  if (normalized === "saida") return "SAIDA";
  if (normalized === "neutro") return "NEUTRO";
  return null;
}

// One lookup covers both unique names ("Salário") and names that repeat
// across classifications ("Pets — Prazer e Conforto") — see
// src/lib/category-display.ts, the same helper used to build the
// template's reference sheet, so whatever a user copies from there
// resolves back to exactly one category id here.
function buildCategoryLookup(categories: SpreadsheetCategory[]): Map<string, string> {
  const withDisplay = withCategoryDisplayName(categories.filter((c) => c.isActive));
  const map = new Map<string, string>();
  for (const c of withDisplay) {
    map.set(`${c.type}|${normalizeText(c.displayName)}`, c.id);
  }
  return map;
}

function findByName(options: SpreadsheetSimpleOption[], name: string): string | null {
  const normalized = normalizeText(name);
  return options.find((o) => normalizeText(o.name) === normalized)?.id ?? null;
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  context: {
    categories: SpreadsheetCategory[];
    paymentMethods: SpreadsheetSimpleOption[];
    tags: SpreadsheetSimpleOption[];
  }
): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true });
  } catch {
    return { error: "Não foi possível ler esta planilha. Verifique se o arquivo não está corrompido." };
  }

  const sheetName =
    workbook.SheetNames.find((name) => normalizeText(name) === "lancamentos") ?? workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) {
    return { error: "Planilha vazia ou sem uma aba de lançamentos." };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rawRows.length === 0) {
    return { error: "Nenhuma linha encontrada na planilha." };
  }

  const headerLookup = new Map<string, keyof RawRow>();
  for (const key of Object.keys(rawRows[0])) {
    const mapped = HEADER_KEYS[normalizeText(key)];
    if (mapped) headerLookup.set(key, mapped);
  }
  const mappedFields = new Set(headerLookup.values());
  if (!mappedFields.has("date") || !mappedFields.has("amount")) {
    return {
      error: "Colunas obrigatórias não encontradas. Baixe o modelo novamente e não altere os cabeçalhos.",
    };
  }

  const categoryLookup = buildCategoryLookup(context.categories);
  const rows: ParsedTransactionRow[] = [];

  for (const rawRow of rawRows) {
    const row: RawRow = {};
    for (const [key, value] of Object.entries(rawRow)) {
      const mapped = headerLookup.get(key);
      if (mapped) row[mapped] = value;
    }

    const date = parseTemplateDate(row.date);
    const amountCents = parseTemplateAmount(row.amount);
    const type = parseTemplateType(row.type) ?? (amountCents !== null ? "SAIDA" : null);
    const isBlankRow = !date && amountCents === null && !type && !String(row.description ?? "").trim();
    if (isBlankRow) continue;

    const warnings: string[] = [];
    if (!date) warnings.push("Data não reconhecida.");
    if (amountCents === null) warnings.push("Valor não reconhecido.");
    if (!type) warnings.push('Tipo não reconhecido — use "Entrada", "Saída" ou "Neutro".');

    const categoryText = String(row.category ?? "").trim();
    let suggestedCategoryId: string | null = null;
    if (categoryText && type) {
      suggestedCategoryId = categoryLookup.get(`${type}|${normalizeText(categoryText)}`) ?? null;
      if (!suggestedCategoryId) {
        warnings.push(`Categoria "${categoryText}" não encontrada — selecione manualmente.`);
      }
    } else if (!categoryText) {
      warnings.push("Categoria não informada — selecione manualmente.");
    }

    const paymentMethodText = String(row.paymentMethod ?? "").trim();
    const suggestedPaymentMethodId = paymentMethodText
      ? findByName(context.paymentMethods, paymentMethodText)
      : null;

    const tagText = String(row.tag ?? "").trim();
    const suggestedTagId = tagText ? findByName(context.tags, tagText) : null;

    rows.push({
      rowId: crypto.randomUUID(),
      date: date ?? "",
      description: String(row.description ?? "").trim(),
      amountCents: amountCents ?? 0,
      type: type ?? "SAIDA",
      rawText: [String(row.date ?? ""), String(row.amount ?? ""), categoryText].filter(Boolean).join(" · "),
      suggestedCategoryId,
      suggestedCategoryConfidence: null,
      suggestedCategoryReason: null,
      suggestedPaymentMethodId,
      suggestedPaymentMethodName: paymentMethodText && !suggestedPaymentMethodId ? paymentMethodText : null,
      suggestedTagId,
      possibleDuplicateOfId: null,
      parseWarnings: warnings,
    });
  }

  if (rows.length === 0) {
    return { error: "Nenhum lançamento válido encontrado na planilha." };
  }

  return { rows };
}
