import type { Classification, TransactionType } from "@/generated/prisma/enums";

/**
 * Starter categories given to every newly-registered user.
 *
 * This is a PROVISIONAL list, not the official one — it's carried forward
 * unchanged from the shared category set the system already had before
 * categories became per-user/editable. The official default list will be
 * supplied later; when it is, only this file needs to change. Categories
 * themselves are fully editable per-user after registration (rename,
 * reclassify, deactivate) — Classification is the only fixed part.
 */
export const DEFAULT_CATEGORY_TEMPLATE: {
  name: string;
  type: TransactionType;
  classification: Classification;
  order: number;
}[] = [
  { name: "Salário", type: "ENTRADA", classification: "RECEITA", order: 1 },
  { name: "Freelance", type: "ENTRADA", classification: "RECEITA", order: 2 },
  { name: "Outras Receitas", type: "ENTRADA", classification: "RECEITA", order: 4 },

  { name: "Moradia", type: "SAIDA", classification: "CUSTOS_OBRIGATORIOS", order: 1 },
  { name: "Contas e Utilidades", type: "SAIDA", classification: "CUSTOS_OBRIGATORIOS", order: 2 },
  { name: "Supermercado", type: "SAIDA", classification: "CUSTOS_OBRIGATORIOS", order: 5 },
  { name: "Transporte", type: "SAIDA", classification: "CUSTOS_OBRIGATORIOS", order: 6 },
  { name: "Saúde", type: "SAIDA", classification: "CUSTOS_OBRIGATORIOS", order: 7 },
  { name: "Outras Despesas", type: "SAIDA", classification: "CUSTOS_OBRIGATORIOS", order: 10 },

  { name: "Assinaturas", type: "SAIDA", classification: "CONFORTOS", order: 3 },
  { name: "Vestuário", type: "SAIDA", classification: "CONFORTOS", order: 9 },

  { name: "Lazer", type: "SAIDA", classification: "PRAZERES", order: 8 },

  { name: "Investimentos", type: "SAIDA", classification: "INVESTIMENTOS", order: 3 },

  { name: "Educação", type: "SAIDA", classification: "CONHECIMENTO", order: 4 },
];
