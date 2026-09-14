import { Wallet, Car, Home, Building2, Gem, FileText, FileSignature, Users, AlertTriangle, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

/** One icon + short explanatory subtitle per cadastro group, shown next
 * to each CollapsibleSection's title in "Cadastros Gerais" — purely
 * presentational, kept apart from patrimonio-colors.ts (identity
 * colors) and patrimonio-fields.ts (form columns) since this is neither. */
export const PATRIMONIO_ASSET_GROUP_META: Record<PatrimonioAssetCategory, { icon: LucideIcon; subtitle: string }> = {
  FINANCEIRO: {
    icon: Wallet,
    subtitle: "Investimentos, contas e recursos financeiros que compõem seu patrimônio.",
  },
  BEM_MOVEL: {
    icon: Car,
    subtitle: "Veículos, equipamentos e outros bens móveis de valor relevante.",
  },
  BEM_IMOVEL: {
    icon: Home,
    subtitle: "Casas, apartamentos, terrenos, salas comerciais e demais imóveis.",
  },
  INTANGIVEL: {
    icon: Building2,
    subtitle: "Participações societárias, empresas, marcas, direitos e outros ativos intangíveis.",
  },
  COLECIONAVEL: {
    icon: Gem,
    subtitle: "Obras de arte, joias, relógios, coleções e bens especiais.",
  },
};

export const PATRIMONIO_LIABILITY_GROUP_META: Record<PatrimonioLiabilityCategory, { icon: LucideIcon; subtitle: string }> = {
  EMPRESTIMO_DIVIDA: {
    icon: FileText,
    subtitle: "Dívidas pessoais, empréstimos e obrigações financeiras em aberto.",
  },
  FINANCIAMENTO: {
    icon: FileSignature,
    subtitle: "Financiamentos vinculados ou não à aquisição de bens.",
  },
  CONSORCIO: {
    icon: Users,
    subtitle: "Cartas de crédito, parcelas e saldos de consórcios.",
  },
  OUTRO: {
    icon: AlertTriangle,
    subtitle: "Outras obrigações que reduzem o patrimônio líquido.",
  },
};

export const PATRIMONIO_PROTECTION_GROUP_META: { icon: LucideIcon; subtitle: string } = {
  icon: Shield,
  subtitle: "Proteções, seguros, estruturas patrimoniais e estratégias sucessórias.",
};
