import type { Classification, TransactionType } from "@/generated/prisma/enums";

export const TYPE_LABELS: Record<TransactionType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  RECEITA: "Receita",
  CUSTOS_OBRIGATORIOS: "Custos Obrigatórios",
  CONFORTOS: "Confortos",
  PRAZERES: "Prazeres",
  INVESTIMENTOS: "Investimentos",
  CONHECIMENTO: "Conhecimento",
  METAS: "Metas",
};
