import type {
  Classification,
  RecurrencePeriodicity,
  SeriesType,
  TransactionStatus,
  TransactionType,
} from "@/generated/prisma/enums";

export const TYPE_LABELS: Record<TransactionType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  NEUTRO: "Neutro",
};

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  RECEITA: "Receita",
  CUSTOS_OBRIGATORIOS: "Custos Obrigatórios",
  PRAZERES_E_CONFORTOS: "Prazeres e Confortos",
  INVESTIMENTOS: "Investimentos",
  NEUTRA: "Neutra",
};

// Shown directly under the classification name in Orçamento (never in a
// tooltip) — plain language, meant to help decide where a given expense
// belongs.
export const CLASSIFICATION_DESCRIPTIONS: Record<Classification, string> = {
  RECEITA: "Todo o dinheiro que entra: salário, freelance e outras fontes de renda.",
  CUSTOS_OBRIGATORIOS: "Gastos necessários para manter sua vida funcionando e cumprir seus compromissos.",
  PRAZERES_E_CONFORTOS: "Gastos que tornam sua vida mais confortável ou prazerosa, mas que podem ser reduzidos, adiados ou ajustados quando necessário.",
  INVESTIMENTOS: "Dinheiro destinado à construção de patrimônio, investimentos e realização de objetivos futuros.",
  NEUTRA: "Movimentações que não são nem receita nem despesa, como pagamento de fatura, reembolso ou transferência entre suas próprias contas.",
};

// Singular form used only to disambiguate two categories that share the
// same name across different Classifications (e.g. "Pets — Custo
// Obrigatório" vs "Pets — Prazer e Conforto") — see
// src/lib/category-display.ts. CLASSIFICATION_LABELS stays plural for
// every other use (headings, badges, selects).
export const CLASSIFICATION_DISAMBIGUATION_LABELS: Record<Classification, string> = {
  RECEITA: "Receita",
  CUSTOS_OBRIGATORIOS: "Custo Obrigatório",
  PRAZERES_E_CONFORTOS: "Prazer e Conforto",
  INVESTIMENTOS: "Investimento",
  NEUTRA: "Neutro",
};

// How sure the import's pending-occurrence reconciliation matcher
// (src/lib/import/reconciliation.ts) is that an imported row fulfills a
// predicted recurring/installment occurrence — shown as a badge in the
// import review table. NOT used for category suggestions (see
// SuggestionSource below) — the categorization layer deliberately
// avoids a confidence-based badge, since the model's own declared
// confidence must never be treated as proof of correctness.
export type SuggestionConfidence = "HIGH" | "MEDIUM" | "LOW";

export const CONFIDENCE_LABELS: Record<SuggestionConfidence, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};

// Where a category suggestion came from (src/lib/import/merchant-resolver.ts)
// — traceability only, never a stand-in for validation. Every suggestion,
// regardless of source, still goes through full user review before import.
export type SuggestionSource = "HISTORY" | "GLOBAL" | "AI" | "RESEARCH_AI" | "USER";

export const SOURCE_LABELS: Record<SuggestionSource, string> = {
  HISTORY: "Histórico",
  GLOBAL: "Conhecimento",
  AI: "IA",
  RESEARCH_AI: "Pesquisa",
  USER: "Informado",
};

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  PAGO: "Pago",
  NAO_PAGO: "Não pago",
};

export const SERIES_TYPE_LABELS: Record<SeriesType, string> = {
  RECORRENTE: "Recorrente",
  PARCELADO: "Parcelado",
};

export const PERIODICITY_LABELS: Record<RecurrencePeriodicity, string> = {
  MENSAL: "Mensal",
};

// "Alterar/excluir só esta ocorrência" vs "esta e as próximas ainda não
// pagas" — the choice presented whenever editing/deleting a transaction
// that belongs to a series (src/components/lancamentos/TransactionsBoard.tsx).
export type SeriesEditScope = "this" | "this_and_future";
