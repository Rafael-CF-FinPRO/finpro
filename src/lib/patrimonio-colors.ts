import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

// Same convention as src/lib/classification-colors.ts: one identity per
// category, defined as CSS custom properties (src/app/globals.css) so
// every chart/badge/legend tracks the active theme automatically.
export const PATRIMONIO_ASSET_CATEGORY_COLORS: Record<PatrimonioAssetCategory, string> = {
  FINANCEIRO: "var(--patrimonio-financeiro)",
  BEM_MOVEL: "var(--patrimonio-bem-movel)",
  BEM_IMOVEL: "var(--patrimonio-bem-imovel)",
  INTANGIVEL: "var(--patrimonio-intangivel)",
  COLECIONAVEL: "var(--patrimonio-colecionavel)",
};

export const PATRIMONIO_LIABILITY_CATEGORY_COLORS: Record<PatrimonioLiabilityCategory, string> = {
  EMPRESTIMO_DIVIDA: "var(--patrimonio-liability-emprestimo)",
  FINANCIAMENTO: "var(--patrimonio-liability-financiamento)",
  CONSORCIO: "var(--patrimonio-liability-consorcio)",
  OUTRO: "var(--patrimonio-liability-outro)",
};

export const PATRIMONIO_ASSET_CATEGORY_LABELS: Record<PatrimonioAssetCategory, string> = {
  FINANCEIRO: "Financeiro",
  BEM_MOVEL: "Bens Móveis",
  BEM_IMOVEL: "Bens Imóveis",
  INTANGIVEL: "Intangível",
  COLECIONAVEL: "Colecionáveis, Bens de Luxo e Outros",
};

export const PATRIMONIO_LIABILITY_CATEGORY_LABELS: Record<PatrimonioLiabilityCategory, string> = {
  EMPRESTIMO_DIVIDA: "Empréstimos e Dívidas",
  FINANCIAMENTO: "Financiamentos",
  CONSORCIO: "Consórcios",
  OUTRO: "Outros Passivos",
};

// Shared by every asset table's "Tipo"/"Localização"/"Nível de
// Liquidez" columns (view and edit) — centralized here instead of
// duplicated per table component.
export const PATRIMONIO_USAGE_LABELS: Record<string, string> = {
  USO_PESSOAL: "Uso Pessoal",
  GERADOR_RENDA: "Gerador de Renda",
};

export const PATRIMONIO_LOCATION_LABELS: Record<string, string> = {
  ONSHORE: "Onshore",
  OFFSHORE: "Offshore",
};

export const PATRIMONIO_LIQUIDITY_LABELS: Record<string, string> = {
  ALTA: "Alta Liquidez",
  MEDIA: "Média Liquidez",
  BAIXA: "Baixa Liquidez",
};
