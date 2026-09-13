import type { PatrimonioAssetCategory, PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

/** Which of PatrimonioAsset's category-specific columns apply to a given
 * `category` — the model is one flat table (discriminator pattern, see
 * prisma/schema.prisma) but each category only ever fills in a subset
 * of the optional columns, per the spec's field lists (section 2).
 * `usageType`/`location`/`notes`/`isActive` are common to every category
 * and always shown, so they aren't part of this config. */
export type AssetFieldConfig = {
  liquidity: boolean;
  /** "Performance/Taxa" — a free-text index label (e.g. "CDI", "IPCA+5%"). */
  rateLabel: boolean;
  /** annualRatePct + purchaseDate + purchaseValueCents + updateMethod,
   * shown together — a category either supports projeção automática
   * with a purchase history or it doesn't. */
  projection: boolean;
  /** isRented + rentNetValueCents — Bens Imóveis only. */
  rent: boolean;
};

export const ASSET_CATEGORY_FIELD_CONFIG: Record<PatrimonioAssetCategory, AssetFieldConfig> = {
  FINANCEIRO: { liquidity: true, rateLabel: true, projection: false, rent: false },
  BEM_MOVEL: { liquidity: false, rateLabel: true, projection: true, rent: false },
  BEM_IMOVEL: { liquidity: false, rateLabel: true, projection: true, rent: true },
  INTANGIVEL: { liquidity: false, rateLabel: false, projection: false, rent: false },
  COLECIONAVEL: { liquidity: false, rateLabel: true, projection: true, rent: false },
};

/** Same idea for PatrimonioLiability — which optional columns apply per
 * category (spec section 3). `name`/`currentBalanceCents`/`notes`/
 * `isActive` are common to every category. */
export type LiabilityFieldConfig = {
  /** installmentValueCents + remainingInstallments. */
  installment: boolean;
  amortization: boolean;
  cet: boolean;
  correctionIndex: boolean;
  administrationFee: boolean;
  creditValue: boolean;
  liabilityType: boolean;
  linkedAsset: boolean;
  startDate: boolean;
  expectedEndDate: boolean;
  dueDate: boolean;
};

const EMPRESTIMO_LIKE: LiabilityFieldConfig = {
  installment: true,
  amortization: true,
  cet: true,
  correctionIndex: true,
  administrationFee: false,
  creditValue: false,
  liabilityType: false,
  linkedAsset: true,
  startDate: true,
  expectedEndDate: true,
  dueDate: false,
};

export const LIABILITY_CATEGORY_FIELD_CONFIG: Record<PatrimonioLiabilityCategory, LiabilityFieldConfig> = {
  EMPRESTIMO_DIVIDA: EMPRESTIMO_LIKE,
  FINANCIAMENTO: EMPRESTIMO_LIKE,
  CONSORCIO: {
    installment: true,
    amortization: false,
    cet: false,
    correctionIndex: true,
    administrationFee: true,
    creditValue: true,
    liabilityType: false,
    linkedAsset: true,
    startDate: false,
    expectedEndDate: false,
    dueDate: false,
  },
  OUTRO: {
    installment: false,
    amortization: false,
    cet: false,
    correctionIndex: true,
    administrationFee: false,
    creditValue: false,
    liabilityType: true,
    linkedAsset: false,
    startDate: false,
    expectedEndDate: false,
    dueDate: true,
  },
};
