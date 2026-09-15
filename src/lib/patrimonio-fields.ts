import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

/** One entry per column shown/edited for a given cadastro category —
 * the single source of truth for both the table header and the inline
 * add/edit row (src/components/patrimonio/patrimonio-field-render.tsx),
 * so a column's label/order/tooltip never drifts between the two.
 * `required` is a UI-level mirror of what src/lib/validation.ts's Zod
 * schemas actually enforce (kept in sync by hand — see the comments
 * there) — it drives the input's `required` attribute and the "*"
 * indicator, never validation itself. */
export type PatrimonioFieldColumn<K extends string = string> = {
  key: K;
  label: string;
  required: boolean;
  tooltip?: string;
};

/** Every field key that can appear in a cadastro table, mapped to how
 * it should render/edit — independent of which category uses it, so
 * this is one flat map shared by assets, liabilities and proteção
 * (src/components/patrimonio/patrimonio-field-render.tsx switches on
 * this, not on the entity type). */
export type PatrimonioFieldType =
  | "text"
  | "textarea"
  | "money"
  | "percent"
  | "date"
  | "integer"
  | "usage"
  | "location"
  | "liquidity"
  | "boolean"
  | "linkedAsset";

export const PATRIMONIO_FIELD_TYPE: Record<string, PatrimonioFieldType> = {
  name: "text",
  element: "text",
  currentValueCents: "money",
  currentBalanceCents: "money",
  purchaseValueCents: "money",
  rentNetValueCents: "money",
  installmentValueCents: "money",
  creditValueCents: "money",
  institutionName: "text",
  paidValueCents: "money",
  additionalInvestmentCents: "money",
  capitalInvestedCents: "money",
  idealValueCents: "money",
  usageType: "usage",
  location: "location",
  liquidity: "liquidity",
  rateLabel: "text",
  annualRatePct: "percent",
  cetPct: "percent",
  administrationFeePct: "percent",
  purchaseDate: "date",
  dueDate: "date",
  startDate: "date",
  expectedEndDate: "date",
  contemplationDate: "date",
  isRented: "boolean",
  isNeeded: "boolean",
  isCovered: "boolean",
  isContemplated: "boolean",
  remainingInstallments: "integer",
  amortization: "text",
  correctionIndex: "text",
  linkedAssetId: "linkedAsset",
  objective: "textarea",
  notes: "textarea",
};

const LIQUIDITY_TOOLTIP =
  "Indica a facilidade e velocidade para transformar este ativo em dinheiro sem perda relevante de valor.";
// Calculated automatically (src/lib/patrimonio.ts's computeAssetAppreciationRate)
// from Valor de Compra/Valor Atual/datas — never a manually-typed figure,
// hence no input for it anywhere in the edit row. Intangível only —
// Bens Móveis/Imóveis/Colecionáveis use CAPITAL_RETURN_TOOLTIP instead.
const TAXA_CORRECAO_TOOLTIP =
  "Calculada automaticamente: valorização ou desvalorização anualizada entre a data de compra e a última atualização do valor atual.";
const RENDIMENTO_ALUGUEL_TOOLTIP = "Calculado automaticamente: Aluguel Líquido ÷ Valor Atual do imóvel, ao mês.";
// Calculated automatically (src/lib/patrimonio.ts's computeCapitalReturn)
// from Capital Total Investido/Valor Atual/datas — never a
// manually-typed figure.
const CAPITAL_RETURN_TOOLTIP =
  "Apresenta o retorno acumulado e o retorno anualizado do bem, considerando o capital efetivamente investido.";
const ADDITIONAL_INVESTMENT_TOOLTIP =
  "Somatório dos valores investidos após a aquisição do imóvel, como reformas, ampliações, adaptações, instalações e outras melhorias incorporadas ao patrimônio.";
const CAPITAL_INVESTED_TOOLTIP = "Calculado automaticamente: Valor de Compra + Investimentos Adicionais, quando aplicável.";

/** Shared by the "Documento Anexado" upload field (server-side check in
 * src/app/actions/patrimonio.ts) and its UI hint text — one document
 * per item, same 5 MB cap the CSV/OFX importer already uses
 * (MAX_IMPORT_FILE_BYTES in src/lib/import/types.ts) for consistency,
 * kept as its own constant since the two features are unrelated. */
export const MAX_PATRIMONIO_DOCUMENT_BYTES = 5 * 1024 * 1024;

export type AssetColumnKey =
  | "name"
  | "currentValueCents"
  | "usageType"
  | "rateLabel"
  | "location"
  | "liquidity"
  | "annualRatePct"
  | "capitalReturnPct"
  | "purchaseDate"
  | "purchaseValueCents"
  | "additionalInvestmentCents"
  | "capitalInvestedCents"
  | "isRented"
  | "rentNetValueCents"
  | "rentalYieldPct"
  | "notes";

/** Ordered column list per PatrimonioAssetCategory — mirrors the
 * reference spreadsheet's own field list per category (spec sections
 * 5-9). "Tipo" and "Nível de Liquidez" are required in every category;
 * Financeiro additionally requires Performance/Localização (see
 * validation.ts's superRefine on patrimonioAssetSchema). */
export const ASSET_CATEGORY_COLUMNS: Record<PatrimonioAssetCategory, PatrimonioFieldColumn<AssetColumnKey>[]> = {
  FINANCEIRO: [
    { key: "name", label: "Conta", required: true },
    { key: "currentValueCents", label: "Valor Atual", required: true },
    { key: "usageType", label: "Tipo", required: true },
    { key: "rateLabel", label: "Performance", required: true },
    { key: "location", label: "Localização", required: true },
    { key: "liquidity", label: "Nível de Liquidez", required: true, tooltip: LIQUIDITY_TOOLTIP },
    { key: "notes", label: "Observações", required: false },
  ],
  BEM_MOVEL: [
    { key: "name", label: "Descrição", required: true },
    { key: "currentValueCents", label: "Valor Atual", required: true },
    { key: "usageType", label: "Tipo", required: true },
    {
      key: "capitalReturnPct",
      label: "Retorno sobre o Capital Investido (%)",
      required: false,
      tooltip: CAPITAL_RETURN_TOOLTIP,
    },
    { key: "purchaseDate", label: "Data de Compra", required: false },
    { key: "purchaseValueCents", label: "Valor de Compra", required: false },
    { key: "capitalInvestedCents", label: "Capital Total Investido", required: false, tooltip: CAPITAL_INVESTED_TOOLTIP },
    { key: "location", label: "Localização", required: false },
    { key: "liquidity", label: "Nível de Liquidez", required: true, tooltip: LIQUIDITY_TOOLTIP },
    { key: "notes", label: "Observações", required: false },
  ],
  BEM_IMOVEL: [
    { key: "name", label: "Descrição", required: true },
    { key: "currentValueCents", label: "Valor Venal", required: true },
    { key: "usageType", label: "Tipo", required: true },
    {
      key: "capitalReturnPct",
      label: "Retorno sobre o Capital Investido (%)",
      required: false,
      tooltip: CAPITAL_RETURN_TOOLTIP,
    },
    { key: "purchaseDate", label: "Data de Compra", required: false },
    { key: "purchaseValueCents", label: "Valor de Compra", required: false },
    {
      key: "additionalInvestmentCents",
      label: "Investimentos Adicionais",
      required: false,
      tooltip: ADDITIONAL_INVESTMENT_TOOLTIP,
    },
    { key: "capitalInvestedCents", label: "Capital Total Investido", required: false, tooltip: CAPITAL_INVESTED_TOOLTIP },
    { key: "isRented", label: "Alugado?", required: false },
    { key: "rentNetValueCents", label: "Aluguel Líquido", required: false },
    {
      key: "rentalYieldPct",
      label: "Rendimento do Aluguel (%)",
      required: false,
      tooltip: RENDIMENTO_ALUGUEL_TOOLTIP,
    },
    { key: "location", label: "Localização", required: false },
    { key: "liquidity", label: "Nível de Liquidez", required: true, tooltip: LIQUIDITY_TOOLTIP },
    { key: "notes", label: "Observações", required: false },
  ],
  INTANGIVEL: [
    { key: "name", label: "Descrição", required: true },
    { key: "currentValueCents", label: "Valor / Equity", required: true },
    { key: "usageType", label: "Tipo", required: true },
    { key: "annualRatePct", label: "Taxa de Correção Anual (%)", required: false, tooltip: TAXA_CORRECAO_TOOLTIP },
    { key: "purchaseDate", label: "Data de Aquisição", required: false },
    { key: "purchaseValueCents", label: "Valor de Compra/Aquisição", required: false },
    { key: "location", label: "Localização", required: false },
    { key: "liquidity", label: "Nível de Liquidez", required: true, tooltip: LIQUIDITY_TOOLTIP },
    { key: "notes", label: "Observações", required: false },
  ],
  COLECIONAVEL: [
    { key: "name", label: "Descrição", required: true },
    { key: "currentValueCents", label: "Valor do Item", required: true },
    { key: "usageType", label: "Tipo", required: true },
    {
      key: "capitalReturnPct",
      label: "Retorno sobre o Capital Investido (%)",
      required: false,
      tooltip: CAPITAL_RETURN_TOOLTIP,
    },
    { key: "purchaseDate", label: "Data de Compra", required: false },
    { key: "purchaseValueCents", label: "Valor de Compra", required: false },
    { key: "capitalInvestedCents", label: "Capital Total Investido", required: false, tooltip: CAPITAL_INVESTED_TOOLTIP },
    { key: "location", label: "Localização", required: false },
    { key: "liquidity", label: "Nível de Liquidez", required: true, tooltip: LIQUIDITY_TOOLTIP },
    { key: "notes", label: "Observações", required: false },
  ],
};

export type LiabilityColumnKey =
  | "name"
  | "currentBalanceCents"
  | "creditValueCents"
  | "institutionName"
  | "paidValueCents"
  | "administrationFeePct"
  | "creditCostPct"
  | "installmentValueCents"
  | "remainingInstallments"
  | "amortization"
  | "cetPct"
  | "correctionIndex"
  | "linkedAssetId"
  | "startDate"
  | "expectedEndDate"
  | "dueDate"
  | "isContemplated"
  | "contemplationDate"
  | "notes";

const CET_TOOLTIP = "Custo Efetivo Total da operação, considerando juros, tarifas e demais encargos.";
const CORRECTION_INDEX_TOOLTIP = "Índice que reajusta o saldo ou as parcelas (ex.: IPCA, CDI, INCC).";
const LINKED_ASSET_TOOLTIP = "Associa esta dívida a um bem já cadastrado em Ativos, quando aplicável.";
const AMORTIZATION_TOOLTIP = "Sistema de amortização da dívida (ex.: SAC, PRICE).";
const PAID_VALUE_TOOLTIP =
  "Valor efetivamente pago até o momento no consórcio — diferente do saldo a pagar, do crédito da carta e da taxa de administração.";
// Calculated automatically (src/components/patrimonio/LiabilityCategoryTable.tsx's
// computeCreditCost) from Crédito da Carta, Valor Já Pago, Saldo a
// Pagar e o período contratado — nunca a mesma coisa que a Taxa de
// Administração, que continua sendo preenchida manualmente.
const CREDIT_COST_TOOLTIP =
  "Calculado automaticamente: custo efetivo anualizado do crédito, com base no total pago (já pago + saldo a pagar) frente ao crédito da carta, no período contratado.";

const EMPRESTIMO_LIKE_COLUMNS: PatrimonioFieldColumn<LiabilityColumnKey>[] = [
  { key: "name", label: "Descrição", required: true },
  { key: "currentBalanceCents", label: "Saldo Devedor", required: true },
  { key: "amortization", label: "Amortização", required: false, tooltip: AMORTIZATION_TOOLTIP },
  { key: "installmentValueCents", label: "Valor Parcela Atual", required: false },
  { key: "remainingInstallments", label: "Parcelas Restantes", required: false },
  { key: "cetPct", label: "CET", required: false, tooltip: CET_TOOLTIP },
  { key: "correctionIndex", label: "Índice de Correção", required: false, tooltip: CORRECTION_INDEX_TOOLTIP },
  { key: "linkedAssetId", label: "Vinculado a Bem", required: false, tooltip: LINKED_ASSET_TOOLTIP },
  { key: "startDate", label: "Data da Contratação", required: false },
  { key: "expectedEndDate", label: "Data de Vencimento Final", required: false },
  { key: "notes", label: "Observações", required: false },
];

/** Ordered column list per PatrimonioLiabilityCategory (spec sections
 * 10-13). Empréstimos e Dívidas / Financiamentos share the exact same
 * shape; Consórcios required "Crédito da Carta" instead of nothing
 * extra (validation.ts's superRefine); Outros Passivos is the flexible,
 * shorter one. */
export const LIABILITY_CATEGORY_COLUMNS: Record<PatrimonioLiabilityCategory, PatrimonioFieldColumn<LiabilityColumnKey>[]> = {
  EMPRESTIMO_DIVIDA: EMPRESTIMO_LIKE_COLUMNS,
  FINANCIAMENTO: EMPRESTIMO_LIKE_COLUMNS,
  CONSORCIO: [
    { key: "institutionName", label: "Administradora/Instituição", required: false },
    { key: "name", label: "Descrição ou Finalidade", required: true },
    { key: "creditValueCents", label: "Crédito da Carta", required: false },
    { key: "paidValueCents", label: "Valor Já Pago no Controle", required: true, tooltip: PAID_VALUE_TOOLTIP },
    { key: "currentBalanceCents", label: "Saldo a Pagar", required: true },
    { key: "startDate", label: "Data da Contratação", required: false },
    { key: "expectedEndDate", label: "Data da Última Parcela", required: false },
    {
      key: "administrationFeePct",
      label: "Taxa de Administração",
      required: false,
      tooltip: "Percentual cobrado pela administradora do consórcio — preenchimento manual.",
    },
    { key: "creditCostPct", label: "Custo de Crédito (%)", required: false, tooltip: CREDIT_COST_TOOLTIP },
    { key: "installmentValueCents", label: "Valor Parcela Atual", required: false },
    { key: "remainingInstallments", label: "Parcelas Restantes", required: false },
    { key: "correctionIndex", label: "Índice de Correção", required: false, tooltip: CORRECTION_INDEX_TOOLTIP },
    { key: "linkedAssetId", label: "Vinculado a Bem", required: false, tooltip: LINKED_ASSET_TOOLTIP },
    { key: "isContemplated", label: "Contemplado?", required: false },
    { key: "contemplationDate", label: "Data de Contemplação", required: false },
    { key: "notes", label: "Observações", required: false },
  ],
  OUTRO: [
    { key: "name", label: "Descrição", required: true },
    { key: "currentBalanceCents", label: "Saldo Devedor", required: true },
    { key: "installmentValueCents", label: "Valor da Parcela", required: false },
    { key: "dueDate", label: "Data de Vencimento", required: false },
    { key: "linkedAssetId", label: "Vinculado a Bem", required: false, tooltip: LINKED_ASSET_TOOLTIP },
    { key: "notes", label: "Observações", required: false },
  ],
};

export type ProtectionColumnKey =
  | "element"
  | "currentValueCents"
  | "objective"
  | "idealValueCents"
  | "isNeeded"
  | "isCovered"
  | "notes";

/** The editable fields for Proteção Patrimonial — "Complementação" is
 * deliberately absent here: it's derived (idealValueCents -
 * currentValueCents), never a form field, and is rendered directly by
 * ProtectionTable.tsx instead. */
export const PROTECTION_COLUMNS: PatrimonioFieldColumn<ProtectionColumnKey>[] = [
  { key: "element", label: "Elemento", required: true },
  {
    key: "currentValueCents",
    label: "Valor da Proteção Atual",
    required: false,
    tooltip: "Valor hoje coberto ou provisionado para este elemento.",
  },
  {
    key: "objective",
    label: "Objetivo / Explicação",
    required: false,
    tooltip: "Explica a finalidade deste elemento de proteção patrimonial.",
  },
  {
    key: "idealValueCents",
    label: "Valor Ideal",
    required: false,
    tooltip: "Valor de proteção ou estrutura considerado adequado para o planejamento.",
  },
  { key: "isNeeded", label: "Necessidade", required: true },
  { key: "isCovered", label: "Coberto?", required: true },
  { key: "notes", label: "Observações", required: false },
];
