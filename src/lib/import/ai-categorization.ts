import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai";
import { CLASSIFICATION_DESCRIPTIONS, CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { buildCategoryHistory, applyHistoryTier, findSimilarHistory, type HistoryAggregate } from "./history";
import type { ParsedTransactionRow } from "./types";
import type { MatchCategory } from "./matching";
import type { Classification } from "@/generated/prisma/enums";
import type { SuggestionConfidence } from "@/lib/transaction-labels";

const AI_MODEL = "gpt-4o-mini";
const AI_BATCH_SIZE = 40;
const AI_BATCH_CONCURRENCY = 3;

const SYSTEM_PROMPT = `Você é um classificador de transações financeiras para um aplicativo de finanças pessoais brasileiro.
Para cada transação da lista, escolha a categoria mais apropriada dentre as categorias fornecidas, usando exclusivamente o "index" (um número inteiro) de uma categoria da lista — copie o número exatamente como está, nunca invente um index que não esteja na lista.

Regras:
- Só escolha uma categoria cujo "type" seja EXATAMENTE igual ao "type" da transação.
- Use a descrição da transação e, quando fornecido, o histórico de categorizações anteriores do usuário para descrições semelhantes ("historico") como indícios — mas pode discordar do histórico se a descrição atual sugerir claramente uma categoria diferente.
- Se não houver categoria claramente adequada, ou a descrição for ambígua/genérica demais (ex.: "PAGAMENTO", "TRANSFERENCIA", um código sem sentido), retorne categoryIndex como null e confidence "LOW" — nunca adivinhe.
- confidence "HIGH": indício claro (o estabelecimento ou finalidade é identificável e se encaixa bem em uma categoria). "MEDIUM": indício razoável mas não conclusivo. "LOW": pouco ou nenhum indício.
- "reason" deve ser uma frase curta em português (até cerca de 12 palavras) explicando a escolha, adequada para ser exibida ao usuário.
Responda apenas com o JSON solicitado.`;

const RESPONSE_JSON_SCHEMA = {
  name: "transaction_classifications",
  strict: true,
  schema: {
    type: "object",
    properties: {
      classifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            transactionId: { type: "string" },
            categoryIndex: { type: ["integer", "null"] },
            confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
            reason: { type: "string" },
          },
          required: ["transactionId", "categoryIndex", "confidence", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["classifications"],
    additionalProperties: false,
  },
} as const;

const aiResponseSchema = z.object({
  classifications: z.array(
    z.object({
      transactionId: z.string().min(1),
      categoryIndex: z.number().int().nullable(),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
      reason: z.string().max(300),
    })
  ),
});

type AiSuggestion = { categoryId: string | null; confidence: SuggestionConfidence; reason: string };

// Identifying categories by a small sequential integer (1, 2, 3, ...)
// instead of by their real id or a composite text key is deliberate —
// observed in testing: with the real cuid ("cmtkf6ujh0005..."), the
// model's own "reason" text correctly identified the right category but
// the id it echoed back pointed at an unrelated one; with a text key
// containing accented Portuguese characters, a similar mismatch showed
// up on a different row. A plain integer the model just read off a
// numbered list is by far the easiest thing for it to reproduce exactly,
// with no encoding/copy-paste failure mode — and it's resolved back to
// a real category id entirely server-side, never trusted on its own.
function buildUserPrompt(
  rows: ParsedTransactionRow[],
  activeCategories: MatchCategory[],
  history: HistoryAggregate[]
): string {
  const classificationLines = (Object.keys(CLASSIFICATION_LABELS) as Classification[])
    .map((c) => `${c}: ${CLASSIFICATION_DESCRIPTIONS[c]}`)
    .join("\n");

  const categoryList = activeCategories.map((c, i) => ({
    index: i + 1,
    name: c.name,
    type: c.type,
    classification: c.classification,
  }));

  const transactionList = rows.map((row) => {
    const similar = findSimilarHistory(row.description, row.type, history);
    return {
      transactionId: row.rowId,
      description: row.description,
      type: row.type,
      ...(similar.length > 0
        ? {
            historico: similar.map((s) => ({
              descricao: s.normalizedDescription,
              categoria: s.categoryName,
              ocorrencias: s.occurrences,
            })),
          }
        : {}),
    };
  });

  return [
    "Classificações:",
    classificationLines,
    "",
    "Categorias disponíveis (index, name, type, classification):",
    JSON.stringify(categoryList),
    "",
    "Transações:",
    JSON.stringify(transactionList),
  ].join("\n");
}

async function classifyChunk(
  rows: ParsedTransactionRow[],
  categories: MatchCategory[],
  history: HistoryAggregate[]
): Promise<Map<string, AiSuggestion>> {
  const activeCategories = categories.filter((c) => c.isActive);
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(rows, activeCategories, history) },
    ],
    response_format: { type: "json_schema", json_schema: RESPONSE_JSON_SCHEMA },
    max_completion_tokens: Math.min(8000, rows.length * 150 + 300),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia da OpenAI.");

  const parsed = aiResponseSchema.safeParse(JSON.parse(content));
  if (!parsed.success) throw new Error("Resposta da OpenAI em formato inesperado.");

  const rowById = new Map(rows.map((r) => [r.rowId, r]));
  const result = new Map<string, AiSuggestion>();

  for (const item of parsed.data.classifications) {
    const row = rowById.get(item.transactionId);
    if (!row) continue; // ignore hallucinated/duplicate ids — never trust blindly

    // 1-indexed, matching the "index" field built in buildUserPrompt from
    // this exact same activeCategories array.
    const category =
      item.categoryIndex !== null ? activeCategories[item.categoryIndex - 1] : undefined;
    const isValid = Boolean(category) && category!.type === row.type;

    result.set(
      item.transactionId,
      isValid
        ? { categoryId: category!.id, confidence: item.confidence, reason: item.reason.slice(0, 200) }
        : {
            categoryId: null,
            confidence: "LOW",
            reason:
              item.categoryIndex !== null
                ? "Sugestão da IA inválida — revise manualmente."
                : item.reason.slice(0, 200) || "Não há informação suficiente para determinar a categoria.",
          }
    );
  }

  return result;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export type CategorizeRowsResult = { rows: ParsedTransactionRow[]; warning: string | null };

// The one shared categorization entry point for OFX, PDF and spreadsheet
// imports — never three separate implementations. Rows that already
// carry an explicit suggestion (a spreadsheet's own "Categoria" column
// match) are left untouched and never sent to the AI, preserving
// explicit user input and saving cost. Every other row goes through
// Tier 1 (free, deterministic — strong repeated history) then Tier 2
// (batched AI calls, informed by similar-but-not-identical history).
// Any failure anywhere in this pipeline is caught here and degrades to
// "no suggestion, warn the user" rather than breaking the import.
export async function categorizeRows(
  rows: ParsedTransactionRow[],
  context: { userId: string; categories: MatchCategory[] }
): Promise<CategorizeRowsResult> {
  const eligible = rows.filter((r) => r.suggestedCategoryId === null);
  if (eligible.length === 0) return { rows, warning: null };

  try {
    const history = await buildCategoryHistory(context.userId);
    const { resolved, remaining } = applyHistoryTier(eligible, history);

    let anyChunkFailed = false;
    const aiResults = new Map<string, AiSuggestion>();

    if (remaining.length > 0) {
      const chunks = chunk(remaining, AI_BATCH_SIZE);
      console.log(`[ai-categorization] ${remaining.length} linhas -> ${chunks.length} lote(s)`);
      const outcomes = await mapWithConcurrencyLimit(chunks, AI_BATCH_CONCURRENCY, async (c) => {
        try {
          return await classifyChunk(c, context.categories, history);
        } catch (err) {
          console.error("[ai-categorization] falha ao classificar lote:", err);
          anyChunkFailed = true;
          return new Map<string, AiSuggestion>();
        }
      });
      for (const outcome of outcomes) {
        for (const [rowId, suggestion] of outcome) aiResults.set(rowId, suggestion);
      }
    }

    const resolvedById = new Map(resolved.map((r) => [r.rowId, r]));
    const updatedRows = rows.map((row) => {
      const strongHit = resolvedById.get(row.rowId);
      if (strongHit) return strongHit;
      const ai = aiResults.get(row.rowId);
      if (!ai) return row;
      return {
        ...row,
        suggestedCategoryId: ai.categoryId,
        suggestedCategoryConfidence: ai.confidence,
        suggestedCategoryReason: ai.reason,
      };
    });

    return {
      rows: updatedRows,
      warning: anyChunkFailed
        ? "Categorização automática indisponível para parte dos lançamentos — revise manualmente."
        : null,
    };
  } catch (err) {
    console.error("[ai-categorization] categorizeRows falhou:", err);
    return {
      rows,
      warning: "Categorização automática indisponível no momento — revise manualmente.",
    };
  }
}
