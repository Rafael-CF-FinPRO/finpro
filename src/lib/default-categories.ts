import type { Classification, TransactionType } from "@/generated/prisma/enums";

/**
 * Starter categories given to every newly-registered user. This is the
 * official list — copied verbatim from the reference spreadsheet's
 * "Orçamento de Gastos" sheet, not a paraphrase or "simplified" version
 * of it. Categories are fully editable per-user after registration
 * (rename, reclassify, deactivate) — Classification is the only fixed
 * part.
 *
 * Some categories exist once under Essenciais and once under Não
 * Essenciais (Pets, Transporte, Cuidados Pessoais, Prestadores de
 * Serviço) — per the spreadsheet's own naming, the Classification is
 * spelled out directly in the name (" - Essencial" / " - Não
 * Essencial") so the two never look identical in a flat list, e.g. the
 * Lançamentos category picker. src/lib/category-display.ts is a
 * separate, display-only fallback for the (rarer) case of a user
 * creating two categories that share an identical name without
 * following this convention themselves.
 */
export const DEFAULT_CATEGORY_TEMPLATE: {
  name: string;
  type: TransactionType;
  classification: Classification;
  order: number;
}[] = [
  { name: "Salário", type: "ENTRADA", classification: "RECEITA", order: 1 },
  { name: "Freelance", type: "ENTRADA", classification: "RECEITA", order: 2 },
  { name: "Outras Receitas", type: "ENTRADA", classification: "RECEITA", order: 3 },

  { name: "Saúde", type: "SAIDA", classification: "ESSENCIAIS", order: 1 },
  { name: "Alimentação", type: "SAIDA", classification: "ESSENCIAIS", order: 2 },
  { name: "Educação", type: "SAIDA", classification: "ESSENCIAIS", order: 3 },
  { name: "Essenciais Geral", type: "SAIDA", classification: "ESSENCIAIS", order: 4 },
  { name: "Mercado", type: "SAIDA", classification: "ESSENCIAIS", order: 5 },
  { name: "Moradia", type: "SAIDA", classification: "ESSENCIAIS", order: 6 },
  { name: "Pets - Essencial", type: "SAIDA", classification: "ESSENCIAIS", order: 7 },
  { name: "Prestadores de Serviço - Essencial", type: "SAIDA", classification: "ESSENCIAIS", order: 8 },
  { name: "Seguros", type: "SAIDA", classification: "ESSENCIAIS", order: 9 },
  { name: "Serviços Financeiros", type: "SAIDA", classification: "ESSENCIAIS", order: 10 },
  { name: "Transporte - Essencial", type: "SAIDA", classification: "ESSENCIAIS", order: 11 },
  { name: "Imposto", type: "SAIDA", classification: "ESSENCIAIS", order: 12 },
  { name: "Cuidados Pessoais - Essencial", type: "SAIDA", classification: "ESSENCIAIS", order: 13 },
  { name: "Filhos e Família", type: "SAIDA", classification: "ESSENCIAIS", order: 14 },

  { name: "Viagens e Passeios", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 1 },
  { name: "Assinaturas", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 2 },
  { name: "Compras", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 3 },
  { name: "Lanches, Restaurante e Confraternizações", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 4 },
  { name: "Lazer e Diversão", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 5 },
  { name: "Pets - Não Essencial", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 6 },
  { name: "Presentes e Doações", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 7 },
  { name: "Cuidados Pessoais - Não Essencial", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 8 },
  { name: "Prestadores de Serviço - Não Essencial", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 9 },
  { name: "Roupas e Vestuário", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 10 },
  { name: "Transporte - Não Essencial", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 11 },
  { name: "Outros Não Essenciais", type: "SAIDA", classification: "NAO_ESSENCIAIS", order: 12 },

  { name: "Consórcio", type: "SAIDA", classification: "DIVIDAS", order: 1 },
  { name: "Empréstimo", type: "SAIDA", classification: "DIVIDAS", order: 2 },
  { name: "Financiamento", type: "SAIDA", classification: "DIVIDAS", order: 3 },
  { name: "Financiamentos e Dívidas Geral", type: "SAIDA", classification: "DIVIDAS", order: 4 },
  { name: "Parcelamento Cartão", type: "SAIDA", classification: "DIVIDAS", order: 5 },

  { name: "Carteira de Investimentos", type: "SAIDA", classification: "INVESTIMENTOS", order: 1 },
  { name: "Outros Investimentos", type: "SAIDA", classification: "INVESTIMENTOS", order: 2 },
];
