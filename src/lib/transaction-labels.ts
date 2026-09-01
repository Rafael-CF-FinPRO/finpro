import type { Classification, TransactionType } from "@/generated/prisma/enums";

export const TYPE_LABELS: Record<TransactionType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

export const CLASSIFICATION_LABELS: Record<Classification, string> = {
  RECEITA: "Receita",
  CUSTO_FIXO: "Custo Fixo",
  CUSTO_VARIAVEL: "Custo Variável",
};
