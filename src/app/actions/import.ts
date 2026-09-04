"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getCategories, getPaymentMethods, getTags } from "@/lib/transactions";
import { importCommitSchema } from "@/lib/validation";
import { MAX_IMPORT_FILE_BYTES, type ParsedTransactionRow, type ParseResult } from "@/lib/import/types";
import { parseOfxFile } from "@/lib/import/ofx-parser";
import { parseSpreadsheetBuffer } from "@/lib/import/spreadsheet-parser";
import {
  enrichRowsWithSuggestions,
  flagPossibleDuplicates,
  type MatchCategory,
} from "@/lib/import/matching";
import type { Classification } from "@/generated/prisma/enums";

async function requireUserId() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.userId;
}

type ExtractedFile = { buffer: Buffer; error?: undefined } | { buffer?: undefined; error: string };

async function extractFile(formData: FormData): Promise<ExtractedFile> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Selecione um arquivo para importar." };
  }
  if (file.size === 0) {
    return { error: "O arquivo selecionado está vazio." };
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { error: "Arquivo muito grande. O limite é de 5 MB." };
  }
  const arrayBuffer = await file.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer) };
}

// The AI/history categorization module is dynamically imported here —
// same isolation reasoning as parsePdfImportAction below: this file is
// shared by every import action, so a top-level import of the OpenAI
// client would pull it into the whole Lançamentos page's module graph.
// Any failure (missing key, quota, network, unexpected response) is
// caught here and degrades to "no suggestion, warn the user" — the
// import itself must never break because of this layer.
async function runCategorization(
  userId: string,
  rows: ParsedTransactionRow[],
  categories: MatchCategory[]
): Promise<{ rows: ParsedTransactionRow[]; warning?: string }> {
  try {
    const { categorizeRows } = await import("@/lib/import/ai-categorization");
    const result = await categorizeRows(rows, { userId, categories });
    return { rows: result.rows, warning: result.warning ?? undefined };
  } catch (err) {
    console.error("[import] categorização automática indisponível:", err);
    return {
      rows,
      warning: "Categorização automática indisponível no momento — revise manualmente.",
    };
  }
}

async function withSuggestionsAndDuplicates(userId: string, result: ParseResult): Promise<ParseResult> {
  if (result.error || !result.rows) return result;
  const [categories, paymentMethods] = await Promise.all([getCategories(userId), getPaymentMethods(userId)]);
  const { rows: categorized, warning } = await runCategorization(userId, result.rows, categories);
  const enriched = enrichRowsWithSuggestions(categorized, { categories, paymentMethods });
  const rows = await flagPossibleDuplicates(userId, enriched);
  return { rows, warning };
}

export async function parseOfxImportAction(formData: FormData): Promise<ParseResult> {
  const userId = await requireUserId();
  const file = await extractFile(formData);
  if (!file.buffer) return { error: file.error };
  return withSuggestionsAndDuplicates(userId, parseOfxFile(file.buffer));
}

// pdf-parse (pdfjs-dist) is imported dynamically, inside the action, not
// at module scope — this file is a "use server" module shared by every
// import action, so a top-level import here would pull pdfjs-dist's
// worker/font setup into every page that can invoke any of these
// actions (Lançamentos included) at module-load time instead of only
// when a PDF is actually uploaded, turning any load-time failure of
// that dependency into a crash of the whole page rather than just this
// one action.
export async function parsePdfImportAction(formData: FormData): Promise<ParseResult> {
  const userId = await requireUserId();
  const file = await extractFile(formData);
  if (!file.buffer) return { error: file.error };
  try {
    const { parsePdfBuffer } = await import("@/lib/import/pdf-parser");
    return withSuggestionsAndDuplicates(userId, await parsePdfBuffer(file.buffer));
  } catch {
    return { error: "Não foi possível processar este PDF. Tente novamente ou use OFX/planilha." };
  }
}

export async function parseSpreadsheetImportAction(formData: FormData): Promise<ParseResult> {
  const userId = await requireUserId();
  const file = await extractFile(formData);
  if (!file.buffer) return { error: file.error };

  const [categories, paymentMethods, tags] = await Promise.all([
    getCategories(userId),
    getPaymentMethods(userId),
    getTags(userId),
  ]);
  const result = parseSpreadsheetBuffer(file.buffer, { categories, paymentMethods, tags });
  if (result.error || !result.rows) return result;

  const { rows: categorized, warning } = await runCategorization(userId, result.rows, categories);
  const rows = await flagPossibleDuplicates(userId, categorized);
  return { rows, warning };
}

export type ImportCommitState = {
  error?: string;
  rowErrors?: Record<string, string>;
  success?: boolean;
  importedCount?: number;
};

export type ImportCommitRow = {
  rowId: string;
  type: string;
  amountCents: string;
  description: string;
  categoryId: string;
  paymentMethodId: string;
  tagId: string;
  date: string;
  note: string;
};

// Re-validates every row through the same transactionSchema (extended
// with rowId, see importRowSchema in src/lib/validation.ts) that manual
// entry uses, so import can never write a transaction manual entry
// wouldn't allow — client-supplied category/payment-method/tag ids are
// never trusted blindly, mirroring resolveCategory/resolvePaymentMethodId
// /resolveTagId in src/app/actions/transactions.ts, just batched instead
// of one DB round trip per row.
export async function importTransactionsAction(input: {
  rows: ImportCommitRow[];
}): Promise<ImportCommitState> {
  const userId = await requireUserId();

  const parsed = importCommitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Verifique os lançamentos selecionados." };
  }

  const [categories, paymentMethods, tags] = await Promise.all([
    getCategories(userId),
    getPaymentMethods(userId),
    getTags(userId),
  ]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const paymentMethodIds = new Set(paymentMethods.map((pm) => pm.id));
  const tagIds = new Set(tags.map((t) => t.id));

  const rowErrors: Record<string, string> = {};
  const validRows: {
    userId: string;
    type: "ENTRADA" | "SAIDA" | "NEUTRO";
    amountCents: number;
    description: string | null;
    categoryId: string;
    classification: Classification;
    paymentMethodId: string | null;
    tagId: string | null;
    date: Date;
    note: string | null;
  }[] = [];

  for (const row of parsed.data.rows) {
    const category = categoryMap.get(row.categoryId);
    if (!category || category.type !== row.type) {
      rowErrors[row.rowId] = "Selecione uma categoria válida.";
      continue;
    }
    if (row.paymentMethodId && !paymentMethodIds.has(row.paymentMethodId)) {
      rowErrors[row.rowId] = "Selecione um meio de pagamento válido.";
      continue;
    }
    if (row.tagId && !tagIds.has(row.tagId)) {
      rowErrors[row.rowId] = "Selecione uma tag válida.";
      continue;
    }

    validRows.push({
      userId,
      type: row.type,
      amountCents: row.amountCents,
      description: row.description || null,
      categoryId: category.id,
      classification: category.classification,
      paymentMethodId: row.paymentMethodId || null,
      tagId: row.tagId || null,
      date: row.date,
      note: row.note || null,
    });
  }

  if (validRows.length === 0) {
    return { error: "Nenhum lançamento válido para importar.", rowErrors };
  }

  await prisma.transaction.createMany({ data: validRows });

  revalidatePath("/lancamentos");
  return {
    success: true,
    importedCount: validRows.length,
    rowErrors: Object.keys(rowErrors).length > 0 ? rowErrors : undefined,
  };
}
