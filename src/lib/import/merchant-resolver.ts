import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";
import { normalizeMerchantText, normalizeText } from "./text-normalize";
import {
  buildCategoryHistory,
  getStrongHistoryMatch,
  findSimilarHistory,
  type HistoryAggregate,
} from "./history";
import type { MatchCategory } from "./matching";
import { CLASSIFICATION_DESCRIPTIONS, CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import type { Classification, TransactionType } from "@/generated/prisma/enums";
import type { SuggestionSource } from "@/lib/transaction-labels";

// The single central place requirement 26 asks for — normalization,
// grouping, history, the global knowledge base, the AI call, the
// research escalation, and the resulting suggestion all live here.
// Triggered exclusively by the "Categorizar com IA" button
// (src/app/actions/import.ts's categorizeImportRowsAction) — nothing
// in the parse path (ofx-parser.ts/pdf-parser.ts/spreadsheet-parser.ts)
// calls into this file, so importing a statement never touches the
// OpenAI API by itself.

// Deliberately just rowId/description/type — no amount, no payment
// method, no other financial detail is sent to the AI/research layer
// (requirement 11: "não enviar dados financeiros desnecessários").
export type ResolveRequestRow = {
  rowId: string;
  description: string;
  type: TransactionType;
};

export type ResolvedSuggestion = {
  rowId: string;
  categoryId: string;
  source: SuggestionSource;
  reason: string;
};

export type ResolveSummary = {
  history: number;
  global: number;
  ai: number;
  research: number;
  unresolved: number;
};

export type ResolveMerchantsResult = {
  suggestions: ResolvedSuggestion[];
  summary: ResolveSummary;
  warning?: string;
};

const AI_MODEL = "gpt-4o-mini";
const AI_BATCH_SIZE = 40;
const AI_BATCH_CONCURRENCY = 3;
// Research is the last resort and the most expensive/slow step — capped
// hard regardless of how many groups the AI flags, and run with low
// concurrency. A statement with many unknown merchants still gets
// *some* research, just not an unbounded amount in one click.
const MAX_RESEARCH_PER_RUN = 15;
const RESEARCH_CONCURRENCY = 2;

// ---- Grouping (requirement 10) --------------------------------------
// Rows that normalize to the identical merchant text are resolved
// exactly once; the result is fanned out to every row in the group.
// Reuses normalizeMerchantText as-is (requirement 9 already exists).

type MerchantGroup = {
  key: string;
  normalizedDescription: string;
  type: TransactionType;
  representativeDescription: string;
  rowIds: string[];
};

function groupRows(rows: ResolveRequestRow[]): { groups: MerchantGroup[]; ungroupable: string[] } {
  const groups = new Map<string, MerchantGroup>();
  const ungroupable: string[] = [];

  for (const row of rows) {
    const normalized = normalizeMerchantText(row.description);
    if (!normalized) {
      ungroupable.push(row.rowId);
      continue;
    }
    const key = `${row.type}|${normalized}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rowIds.push(row.rowId);
      if (row.description.length > existing.representativeDescription.length) {
        existing.representativeDescription = row.description;
      }
    } else {
      groups.set(key, {
        key,
        normalizedDescription: normalized,
        type: row.type,
        representativeDescription: row.description,
        rowIds: [row.rowId],
      });
    }
  }

  return { groups: [...groups.values()], ungroupable };
}

// ---- Tier: user history (requirement 7, reuses history.ts as-is) ----

function resolveFromHistory(
  group: MerchantGroup,
  history: HistoryAggregate[]
): { categoryId: string; reason: string } | null {
  const match = getStrongHistoryMatch(group.representativeDescription, group.type, history);
  if (!match) return null;
  return { categoryId: match.categoryId, reason: "Categoria recorrente no seu histórico." };
}

// ---- Tier: global knowledge base (requirement 8) ---------------------
// Stores a canonical (name, type, classification) triple, not a
// categoryId — Category is per-user, so a hit is only usable once
// resolved against *this* user's own matching category. A user who
// renamed/deactivated the equivalent category simply gets no match
// here and falls through to AI, same as if the pattern were unknown.

async function resolveFromGlobalBank(
  groups: MerchantGroup[],
  categories: MatchCategory[]
): Promise<Map<string, { categoryId: string; reason: string }>> {
  const patterns = groups.map((g) => g.normalizedDescription);
  if (patterns.length === 0) return new Map();

  const entries = await prisma.merchantKnowledge.findMany({
    where: { normalizedPattern: { in: patterns } },
  });
  if (entries.length === 0) return new Map();

  const entryByPattern = new Map(entries.map((e) => [e.normalizedPattern, e]));
  const categoryByIdentity = new Map(
    categories
      .filter((c) => c.isActive)
      .map((c) => [`${c.type}|${c.classification}|${normalizeText(c.name)}`, c])
  );

  const resolved = new Map<string, { categoryId: string; reason: string }>();
  for (const group of groups) {
    const entry = entryByPattern.get(group.normalizedDescription);
    if (!entry) continue;
    const category = categoryByIdentity.get(
      `${entry.categoryType}|${entry.categoryClassification}|${normalizeText(entry.categoryName)}`
    );
    if (!category || category.type !== group.type) continue;
    resolved.set(group.key, {
      categoryId: category.id,
      reason: `"${entry.categoryName}" é conhecido para estabelecimentos parecidos.`,
    });
  }
  return resolved;
}

// ---- Tier: AI (requirements 11, 12) -----------------------------------
// Chooses only among this user's real categories, by a 1-indexed
// position built fresh per call — a raw cuid id proved unreliable for
// the model to echo back exactly in earlier testing this session,
// while a small integer it just reads off a numbered list is not.
// needsResearch is a routing signal ("this looks like a real
// establishment I don't recognize, a search might identify it" vs.
// "this is generic noise, a search wouldn't help") — never a
// confidence score, and never used to skip review.

const SYSTEM_PROMPT = `Você identifica e categoriza estabelecimentos financeiros para um aplicativo de finanças pessoais brasileiro.
Para cada padrão de estabelecimento da lista:
1. Tente identificar que tipo de negócio ou finalidade a descrição representa.
2. Escolha a categoria mais apropriada dentre as fornecidas, usando exclusivamente o "index" (um número inteiro) de uma categoria da lista — copie o número exatamente como está, nunca invente um index que não esteja na lista. Só escolha uma categoria cujo "type" seja EXATAMENTE igual ao "type" do padrão.
3. Se não conseguir identificar o estabelecimento com segurança apenas pela descrição, mas o nome parecer um estabelecimento real que uma busca poderia esclarecer, retorne categoryIndex como null e needsResearch como true.
4. Se a descrição for genérica, um código sem sentido, ou algo que uma busca não ajudaria a esclarecer (ex: "PAGAMENTO", "TRANSFERENCIA", números aleatórios), retorne categoryIndex como null e needsResearch como false.
5. Quando fornecido, use "historico" (categorizações anteriores do usuário para descrições semelhantes) e "pesquisa" (resultado de uma busca externa, quando presente) como indícios adicionais.
"reason" deve ser uma frase curta em português (até ~12 palavras) adequada para ser exibida ao usuário.
Responda apenas com o JSON solicitado.`;

const RESPONSE_JSON_SCHEMA = {
  name: "merchant_classifications",
  strict: true,
  schema: {
    type: "object",
    properties: {
      classifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            groupId: { type: "string" },
            categoryIndex: { type: ["integer", "null"] },
            needsResearch: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["groupId", "categoryIndex", "needsResearch", "reason"],
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
      groupId: z.string().min(1),
      categoryIndex: z.number().int().nullable(),
      needsResearch: z.boolean(),
      reason: z.string().max(300),
    })
  ),
});

type AiOutcome =
  | { categoryId: string; reason: string; needsResearch: false }
  | { categoryId: null; reason: string; needsResearch: boolean };

function buildClassificationPrompt(
  groups: MerchantGroup[],
  activeCategories: MatchCategory[],
  history: HistoryAggregate[],
  research: Map<string, string>
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

  const groupList = groups.map((g) => {
    const similar = findSimilarHistory(g.representativeDescription, g.type, history);
    const researchText = research.get(g.key);
    return {
      groupId: g.key,
      description: g.representativeDescription,
      type: g.type,
      ...(similar.length > 0
        ? { historico: similar.map((s) => ({ descricao: s.normalizedDescription, categoria: s.categoryName })) }
        : {}),
      ...(researchText ? { pesquisa: researchText } : {}),
    };
  });

  return [
    "Classificações:",
    classificationLines,
    "",
    "Categorias disponíveis (index, name, type, classification):",
    JSON.stringify(categoryList),
    "",
    "Estabelecimentos:",
    JSON.stringify(groupList),
  ].join("\n");
}

async function classifyGroupChunk(
  groups: MerchantGroup[],
  activeCategories: MatchCategory[],
  history: HistoryAggregate[],
  research: Map<string, string>
): Promise<Map<string, AiOutcome>> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildClassificationPrompt(groups, activeCategories, history, research) },
    ],
    response_format: { type: "json_schema", json_schema: RESPONSE_JSON_SCHEMA },
    max_completion_tokens: Math.min(8000, groups.length * 150 + 300),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia da OpenAI.");
  const parsed = aiResponseSchema.safeParse(JSON.parse(content));
  if (!parsed.success) throw new Error("Resposta da OpenAI em formato inesperado.");

  const groupByKey = new Map(groups.map((g) => [g.key, g]));
  const result = new Map<string, AiOutcome>();
  for (const item of parsed.data.classifications) {
    const group = groupByKey.get(item.groupId);
    if (!group) continue; // never trust an echoed id blindly

    const category = item.categoryIndex !== null ? activeCategories[item.categoryIndex - 1] : undefined;
    const isValid = Boolean(category) && category!.type === group.type;

    if (isValid) {
      result.set(item.groupId, { categoryId: category!.id, reason: item.reason.slice(0, 200), needsResearch: false });
    } else {
      result.set(item.groupId, {
        categoryId: null,
        reason: item.categoryIndex !== null ? "" : item.reason.slice(0, 200),
        needsResearch: item.categoryIndex === null ? item.needsResearch : false,
      });
    }
  }
  return result;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function mapWithConcurrencyLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

// ---- Tier: external research (requirements 13-15) ---------------------
// Last resort, only for groups the AI itself flagged as "an
// identifiable establishment I don't recognize" — never run in bulk,
// never a substitute for review. Uses the Responses API's built-in
// web_search tool (confirmed working with gpt-4o-mini during planning
// — the Chat Completions web_search_options parameter only works with
// the now-deprecated *-search-preview models, so this is the current
// supported path). Any failure here — unsupported account, no results,
// network error — degrades to "leave unresolved", which is a valid,
// expected outcome (requirement 32), never a hard failure.
async function researchGroup(group: MerchantGroup): Promise<string | null> {
  try {
    const client = getOpenAIClient();
    const response = await client.responses.create({
      model: AI_MODEL,
      input: `Identifique brevemente, em português, que tipo de estabelecimento comercial brasileiro corresponde a esta descrição de transação financeira: "${group.representativeDescription}". Se não conseguir identificar, responda exatamente "NAO_IDENTIFICADO". Responda em uma frase curta, sem explicações adicionais.`,
      tools: [{ type: "web_search" }],
    });
    const text = response.output_text?.trim();
    if (!text || text.includes("NAO_IDENTIFICADO")) return null;
    return text.slice(0, 300);
  } catch (err) {
    console.error("[merchant-resolver] pesquisa falhou para", group.normalizedDescription, err);
    return null;
  }
}

// ---- Orchestration -----------------------------------------------------

export async function resolveMerchants(
  rows: ResolveRequestRow[],
  context: { userId: string; categories: MatchCategory[] }
): Promise<ResolveMerchantsResult> {
  const activeCategories = context.categories.filter((c) => c.isActive);
  const { groups, ungroupable } = groupRows(rows);

  const summary: ResolveSummary = { history: 0, global: 0, ai: 0, research: 0, unresolved: ungroupable.length };
  const groupResolution = new Map<string, { categoryId: string; source: SuggestionSource; reason: string }>();

  try {
    const history = await buildCategoryHistory(context.userId);

    const remainingAfterHistory: MerchantGroup[] = [];
    for (const group of groups) {
      const hit = resolveFromHistory(group, history);
      if (hit) {
        groupResolution.set(group.key, { ...hit, source: "HISTORY" });
        summary.history++;
      } else {
        remainingAfterHistory.push(group);
      }
    }

    const globalHits = await resolveFromGlobalBank(remainingAfterHistory, activeCategories);
    const remainingAfterGlobal: MerchantGroup[] = [];
    for (const group of remainingAfterHistory) {
      const hit = globalHits.get(group.key);
      if (hit) {
        groupResolution.set(group.key, { ...hit, source: "GLOBAL" });
        summary.global++;
      } else {
        remainingAfterGlobal.push(group);
      }
    }

    let warning: string | undefined;
    const needsResearch: MerchantGroup[] = [];

    if (remainingAfterGlobal.length > 0) {
      const chunks = chunk(remainingAfterGlobal, AI_BATCH_SIZE);
      console.log(
        `[merchant-resolver] ${remainingAfterGlobal.length} estabelecimento(s) -> ${chunks.length} lote(s) de IA`
      );
      const outcomes = await mapWithConcurrencyLimit(chunks, AI_BATCH_CONCURRENCY, async (c) => {
        try {
          return await classifyGroupChunk(c, activeCategories, history, new Map());
        } catch (err) {
          console.error("[merchant-resolver] falha ao classificar lote:", err);
          warning = "Categorização por IA indisponível para parte dos lançamentos — revise manualmente.";
          return new Map<string, AiOutcome>();
        }
      });

      for (const group of remainingAfterGlobal) {
        const outcome = outcomes.flatMap((o) => [...o.entries()]).find(([key]) => key === group.key)?.[1];
        if (!outcome) continue;
        if (outcome.categoryId) {
          groupResolution.set(group.key, { categoryId: outcome.categoryId, source: "AI", reason: outcome.reason });
          summary.ai++;
        } else if (outcome.needsResearch) {
          needsResearch.push(group);
        }
      }
    }

    const toResearch = needsResearch.slice(0, MAX_RESEARCH_PER_RUN);
    if (needsResearch.length > toResearch.length) {
      warning =
        (warning ? warning + " " : "") +
        `Pesquisa limitada a ${MAX_RESEARCH_PER_RUN} estabelecimentos por vez — os demais ficaram para revisão manual.`;
    }

    if (toResearch.length > 0) {
      console.log(`[merchant-resolver] pesquisando ${toResearch.length} estabelecimento(s) desconhecido(s)`);
      const researchResults = await mapWithConcurrencyLimit(toResearch, RESEARCH_CONCURRENCY, async (g) => ({
        key: g.key,
        text: await researchGroup(g),
      }));
      const researchMap = new Map(researchResults.filter((r) => r.text).map((r) => [r.key, r.text!]));

      if (researchMap.size > 0) {
        const researched = toResearch.filter((g) => researchMap.has(g.key));
        try {
          const outcome = await classifyGroupChunk(researched, activeCategories, history, researchMap);
          for (const group of researched) {
            const result = outcome.get(group.key);
            if (result?.categoryId) {
              groupResolution.set(group.key, {
                categoryId: result.categoryId,
                source: "RESEARCH_AI",
                reason: result.reason,
              });
              summary.research++;
            }
          }
        } catch (err) {
          console.error("[merchant-resolver] falha ao classificar após pesquisa:", err);
        }
      }
    }

    const suggestions: ResolvedSuggestion[] = [];
    for (const group of groups) {
      const resolution = groupResolution.get(group.key);
      if (!resolution) continue;
      for (const rowId of group.rowIds) {
        suggestions.push({ rowId, ...resolution });
      }
    }

    const resolvedRowCount = suggestions.length;
    summary.unresolved = rows.length - resolvedRowCount;

    return { suggestions, summary, warning };
  } catch (err) {
    console.error("[merchant-resolver] resolveMerchants falhou:", err);
    return {
      suggestions: [],
      summary: { history: 0, global: 0, ai: 0, research: 0, unresolved: rows.length },
      warning: "Categorização automática indisponível no momento — revise manualmente.",
    };
  }
}

// ---- Global bank write-back (requirements 21-23) -----------------------
// Called only from the import commit path (src/app/actions/import.ts),
// never at suggestion time — only once the user has actually confirmed
// the row with an AI/research-sourced suggestion left untouched.
// Conservative: a user's own correction never reaches this function at
// all (the client clears suggestionSource the moment the category
// select is changed by hand), so only genuinely-confirmed-as-is
// suggestions ever grow the shared table.
export async function recordConfirmedMerchantKnowledge(
  entries: { description: string; type: TransactionType; category: MatchCategory }[]
): Promise<void> {
  if (entries.length === 0) return;
  const seen = new Set<string>();
  for (const entry of entries) {
    const pattern = normalizeMerchantText(entry.description);
    if (!pattern || seen.has(pattern)) continue;
    seen.add(pattern);
    try {
      await prisma.merchantKnowledge.upsert({
        where: { normalizedPattern: pattern },
        create: {
          normalizedPattern: pattern,
          categoryName: entry.category.name,
          categoryType: entry.category.type,
          categoryClassification: entry.category.classification,
          sampleDescription: entry.description,
        },
        // Already known — leave the existing entry alone rather than
        // overwrite it from a single new confirmation (conservative
        // growth, requirement 23).
        update: {},
      });
    } catch (err) {
      console.error("[merchant-resolver] falha ao gravar conhecimento global:", err);
    }
  }
}
