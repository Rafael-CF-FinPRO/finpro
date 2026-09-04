import type { Classification, TransactionType } from "@/generated/prisma/enums";

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

// How sure the import's AI/history categorization layer (src/lib/import/
// ai-categorization.ts) is about a suggested category — shown as a badge
// in the import review table.
export type SuggestionConfidence = "HIGH" | "MEDIUM" | "LOW";

export const CONFIDENCE_LABELS: Record<SuggestionConfidence, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};
