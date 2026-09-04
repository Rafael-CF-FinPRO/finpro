"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getCategories, getPaymentMethods, getTags } from "@/lib/transactions";
import { importCommitSchema } from "@/lib/validation";
import { MAX_IMPORT_FILE_BYTES, type ParseResult } from "@/lib/import/types";
import { parseOfxFile } from "@/lib/import/ofx-parser";
import { parseSpreadsheetBuffer } from "@/lib/import/spreadsheet-parser";
import { enrichRowsWithSuggestions, flagPossibleDuplicates, type MatchCategory } from "@/lib/import/matching";
import { matchPendingOccurrences } from "@/lib/import/reconciliation";
import type { Classification, TransactionType } from "@/generated/prisma/enums";
import type { SuggestionSource } from "@/lib/transaction-labels";

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

// Parsing only ever extracts, normalizes, suggests a payment method,
// flags duplicates, and flags a possible recurring/installment baixa —
// none of that is AI. Category suggestion is deliberately NOT run here
// anymore; it only happens on demand, when the user clicks "Categorizar
// com IA" in the review table (categorizeImportRowsAction below). This
// is the one behavioral change requested: import must never call the
// OpenAI API by itself.
async function withDuplicateAndReconciliationFlags(userId: string, result: ParseResult): Promise<ParseResult> {
  if (result.error || !result.rows) return result;
  const paymentMethods = await getPaymentMethods(userId);
  const enriched = enrichRowsWithSuggestions(result.rows, { paymentMethods });
  const deduped = await flagPossibleDuplicates(userId, enriched);
  const rows = await matchPendingOccurrences(userId, deduped);
  return { rows };
}

export async function parseOfxImportAction(formData: FormData): Promise<ParseResult> {
  const userId = await requireUserId();
  const file = await extractFile(formData);
  if (!file.buffer) return { error: file.error };
  return withDuplicateAndReconciliationFlags(userId, parseOfxFile(file.buffer));
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
    return withDuplicateAndReconciliationFlags(userId, await parsePdfBuffer(file.buffer));
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

  const deduped = await flagPossibleDuplicates(userId, result.rows);
  const rows = await matchPendingOccurrences(userId, deduped);
  return { rows };
}

// ---- On-demand categorization ("Categorizar com IA") --------------------

export type CategorizeRequestRow = {
  rowId: string;
  description: string;
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
};

export type CategorizeSuggestion = {
  rowId: string;
  categoryId: string;
  source: SuggestionSource;
  reason: string;
};

export type CategorizeImportRowsResult = {
  suggestions: CategorizeSuggestion[];
  summary: { history: number; global: number; ai: number; research: number; unresolved: number };
  warning?: string;
};

// The only entry point that touches the OpenAI API in the whole import
// flow — called exclusively by the "Categorizar com IA" button
// (src/components/lancamentos/ImportReviewTable.tsx), never from the
// parse actions above. The merchant-resolver module is dynamically
// imported for the same module-isolation reason as pdf-parser above.
// The caller is expected to only send rows that still need a category
// (categoryId === "") — rows already set (spreadsheet-provided or
// manually picked) are simply never included in the request, so they
// can never be overwritten (requirement 17), no extra logic needed.
export async function categorizeImportRowsAction(input: {
  rows: CategorizeRequestRow[];
}): Promise<CategorizeImportRowsResult> {
  const userId = await requireUserId();
  const emptySummary = { history: 0, global: 0, ai: 0, research: 0, unresolved: input.rows.length };

  if (input.rows.length === 0) {
    return { suggestions: [], summary: emptySummary };
  }

  try {
    const categories = await getCategories(userId);
    const { resolveMerchants } = await import("@/lib/import/merchant-resolver");
    const result = await resolveMerchants(input.rows, { userId, categories });
    return { suggestions: result.suggestions, summary: result.summary, warning: result.warning };
  } catch (err) {
    console.error("[import] categorização sob demanda indisponível:", err);
    return {
      suggestions: [],
      summary: emptySummary,
      warning: "Categorização automática indisponível no momento — revise manualmente.",
    };
  }
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
  reconcile?: boolean;
  matchedPendingTransactionId?: string;
  externalId?: string;
  // Set only when this row still carries an un-overridden AI/research
  // suggestion at confirm time (cleared the moment the user picks a
  // category by hand — see ImportReviewTable.tsx) — used below to grow
  // the global knowledge base conservatively (requirements 21-23).
  suggestionSource?: string;
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

  // Rows marked "reconcile" are checked against the user's own pending
  // occurrences in one query, rather than one lookup per row — only
  // an id that's actually NAO_PAGO and owned by this user is honored;
  // anything else silently falls back to a normal insert below (never
  // trusts the client's matchedPendingTransactionId blindly).
  const claimedPendingIds = parsed.data.rows
    .filter((r) => r.reconcile && r.matchedPendingTransactionId)
    .map((r) => r.matchedPendingTransactionId!);
  const pendingTargets =
    claimedPendingIds.length > 0
      ? await prisma.transaction.findMany({
          where: { userId, status: "NAO_PAGO", id: { in: claimedPendingIds } },
          select: { id: true },
        })
      : [];
  const pendingTargetIds = new Set(pendingTargets.map((t) => t.id));

  const rowErrors: Record<string, string> = {};
  type ValidatedRow = {
    reconcileId: string | null;
    knowledgeEntry: { description: string; type: TransactionType; category: MatchCategory } | null;
    data: {
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
      status: "PAGO";
      externalId: string | null;
    };
  };
  const validRows: ValidatedRow[] = [];

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

    const reconcileId =
      row.reconcile && row.matchedPendingTransactionId && pendingTargetIds.has(row.matchedPendingTransactionId)
        ? row.matchedPendingTransactionId
        : null;

    validRows.push({
      reconcileId,
      knowledgeEntry:
        (row.suggestionSource === "AI" || row.suggestionSource === "RESEARCH_AI") && row.description
          ? { description: row.description, type: row.type, category }
          : null,
      data: {
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
        // Every imported row represents a movement actually present in
        // the statement/spreadsheet — always PAGO, whether it's a brand
        // new transaction or the fulfillment of a pending prediction
        // (reconcileId below just changes create vs update, never this).
        status: "PAGO",
        externalId: row.externalId || null,
      },
    });
  }

  if (validRows.length === 0) {
    return { error: "Nenhum lançamento válido para importar.", rowErrors };
  }

  // A single atomic transaction because this batch mixes inserts (new
  // transactions) and updates (reconciling a pending occurrence) —
  // createMany alone can't express the update half.
  await prisma.$transaction(
    validRows.map((row) =>
      row.reconcileId
        ? prisma.transaction.update({ where: { id: row.reconcileId }, data: row.data })
        : prisma.transaction.create({ data: row.data })
    )
  );

  // Global knowledge base only grows here, at confirm time, and only
  // for rows whose AI/research suggestion the user left untouched
  // (requirements 21-23) — never on parse, never on suggestion, never
  // for a manual pick or a spreadsheet-provided category.
  const knowledgeEntries = validRows.map((r) => r.knowledgeEntry).filter((e) => e !== null);
  if (knowledgeEntries.length > 0) {
    const { recordConfirmedMerchantKnowledge } = await import("@/lib/import/merchant-resolver");
    await recordConfirmedMerchantKnowledge(knowledgeEntries);
  }

  revalidatePath("/lancamentos");
  return {
    success: true,
    importedCount: validRows.length,
    rowErrors: Object.keys(rowErrors).length > 0 ? rowErrors : undefined,
  };
}
