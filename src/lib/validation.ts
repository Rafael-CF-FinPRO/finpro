import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";
import { isValidMonthKey, parseDateInputValue } from "@/lib/dates";

const phoneSchema = z.string().trim().max(30, "Telefone muito longo.").optional().or(z.literal(""));

// Cadastro de cliente pelo Consultor/Admin, ou de consultor pelo Admin —
// não há cadastro público (seção 1 do pedido de estrutura de usuários);
// toda conta nasce pelas mãos de um superior, que já define a senha
// inicial diretamente (repassada ao usuário por fora do sistema).
export const newClientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  phone: phoneSchema,
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

export const newConsultorSchema = newClientSchema;

// Editing an existing cliente's profile from the Consultor/Admin
// Clientes table — same name/e-mail rules as cadastro, no password
// field (senha é redefinida separadamente, via resetUserPasswordSchema).
export const updateClientProfileSchema = z.object({
  id: z.string().min(1, "Cliente inválido."),
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
});

// Same shape, for the Admin editing a Consultor's own cadastro.
export const updateConsultorProfileSchema = z.object({
  id: z.string().min(1, "Consultor inválido."),
  name: z.string().trim().min(2, "Informe o nome completo."),
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
});

// "Meu Perfil" — every role edits only their own name/telefone here;
// e-mail/login is shown but never changed through this schema. Password
// isn't here either — it's always set by a superior (resetUserPasswordSchema).
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo."),
  phone: phoneSchema,
});

// A superior (Admin over a Consultor/Cliente, or Consultor over their
// own Cliente) setting a brand-new password directly — no current
// password to check, since it isn't the account owner doing this.
export const resetUserPasswordSchema = z
  .object({
    id: z.string().min(1, "Usuário inválido."),
    newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres."),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmNewPassword"],
  });

// Admin Master's "Gestão de Funcionalidades" — see src/lib/modules.ts.
export const setModuleStatusSchema = z.object({
  id: z.string().min(1, "Módulo inválido."),
  status: z.enum(["ATIVA", "EM_DESENVOLVIMENTO", "BLOQUEADA"], "Status inválido."),
});

export const setConsultorModuleAccessSchema = z.object({
  moduleId: z.string().min(1, "Módulo inválido."),
  consultorId: z.string().min(1, "Consultor inválido."),
  isEnabled: z.enum(["true", "false"], "Valor inválido.").transform((v) => v === "true"),
});

export const transactionSchema = z.object({
  type: z.enum(["ENTRADA", "SAIDA", "NEUTRO"], "Tipo inválido."),
  amountCents: z
    .string()
    .min(1, "Informe o valor.")
    .transform((value, ctx) => {
      const cents = parseMoneyToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Informe um valor válido." });
        return z.NEVER;
      }
      return cents;
    }),
  description: z
    .string()
    .trim()
    .max(120, "Descrição muito longa.")
    .optional()
    .or(z.literal("")),
  categoryId: z.string().min(1, "Selecione uma categoria."),
  paymentMethodId: z.string().optional().or(z.literal("")),
  tagId: z.string().optional().or(z.literal("")),
  date: z
    .string()
    .min(1, "Informe a data.")
    .transform((value, ctx) => {
      const date = parseDateInputValue(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Informe uma data válida." });
        return z.NEVER;
      }
      return date;
    }),
  note: z
    .string()
    .trim()
    .max(280, "Observação muito longa.")
    .optional()
    .or(z.literal("")),
});

// Shared by recurringSeriesSchema (creation/conversion) and
// updateRecurrenceEndDateSchema (adjusting an existing series) — an
// empty value means open-ended (see src/lib/series.ts's rolling
// top-up). Cross-field checks against the series' own startDate (which
// isn't always part of the same form — see updateRecurrenceEndDateSchema)
// are done by the caller, not here.
const optionalEndDateSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDateInputValue(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Informe uma data final válida." });
      return z.NEVER;
    }
    return date;
  });

// Shared by installmentSeriesSchema (creation/conversion) and
// updateInstallmentCountSchema (adjusting an existing series).
const installmentCountFieldSchema = z
  .string()
  .min(1, "Informe a quantidade de parcelas.")
  .transform((value, ctx) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 2 || n > 360) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma quantidade de parcelas válida (entre 2 e 360).",
      });
      return z.NEVER;
    }
    return n;
  });

// A recurring series reuses every field transactionSchema already
// validates (the "date" field becomes the first occurrence's date) and
// adds only what's specific to recurrence — periodicity, and an
// optional end date.
export const recurringSeriesSchema = z
  .object({
    ...transactionSchema.shape,
    periodicity: z.enum(["MENSAL"], "Periodicidade inválida."),
    endDate: optionalEndDateSchema,
  })
  .refine((data) => !data.endDate || data.endDate >= data.date, {
    message: "A data final deve ser igual ou posterior à data inicial.",
    path: ["endDate"],
  });

// A parcelado series reuses the same base fields — "amountCents" is
// the value of EACH installment (confirmed with the user: parcela
// value drives the total, not the other way around), "date" becomes
// the first installment's date.
export const installmentSeriesSchema = z.object({
  ...transactionSchema.shape,
  installmentCount: installmentCountFieldSchema,
});

// "Alterar/excluir só esta ocorrência" vs "esta e as próximas ainda
// não pagas" — see src/lib/transaction-labels.ts's SeriesEditScope.
export const seriesEditScopeSchema = z.enum(["this", "this_and_future"], "Escolha inválida.");

// Adjusting an ALREADY-EXISTING série's own settings (not creation, not
// per-occurrence field edits) — src/components/lancamentos/
// SeriesSettingsForm.tsx / updateSeriesSettingsAction. The endDate ≥
// startDate check against the série's own startDate happens in the
// action itself, where that value is actually available.
export const updateRecurrenceEndDateSchema = z.object({
  seriesId: z.string().min(1, "Série inválida."),
  endDate: optionalEndDateSchema,
});

export const updateInstallmentCountSchema = z.object({
  seriesId: z.string().min(1, "Série inválida."),
  installmentCount: installmentCountFieldSchema,
});

// One row of a bulk import (src/app/actions/import.ts) — same rules as
// transactionSchema, since import must never be allowed to skip a check
// manual entry enforces, plus a rowId so per-row errors can be reported
// back to the right line in the review table.
export const importRowSchema = transactionSchema.extend({
  rowId: z.string().min(1),
  // Set when the row matched a pending recurring/installment occurrence
  // (src/lib/import/reconciliation.ts) and the user kept that match
  // checked at confirm time — the commit action then updates that
  // existing transaction (status -> PAGO) instead of inserting a new
  // one. Re-validated server-side against the actual pending row, never
  // trusted blindly.
  reconcile: z.boolean().optional().default(false),
  matchedPendingTransactionId: z.string().optional().or(z.literal("")),
  // OFX FITID, threaded through from ParsedTransactionRow so it's
  // actually persisted to Transaction.externalId at commit time —
  // otherwise every future re-import/reconciliation would have nothing
  // to compare against for a transaction created just now.
  externalId: z.string().optional().or(z.literal("")),
  // Present only when the row still carries an un-overridden AI/research
  // category suggestion at confirm time — used to grow the global
  // merchant knowledge base conservatively (src/lib/import/merchant-resolver.ts).
  // Any other value (manual pick, spreadsheet-provided, or simply absent)
  // means "don't touch the global bank for this row".
  suggestionSource: z.string().optional(),
});

export const importCommitSchema = z.object({
  rows: z.array(importRowSchema).min(1, "Selecione ao menos um lançamento."),
});

export const incomeSchema = z.object({
  monthlyIncomeCents: z
    .string()
    .min(1, "Informe a renda mensal.")
    .transform((value, ctx) => {
      const cents = parseMoneyToCents(value);
      if (cents === null) {
        ctx.addIssue({
          code: "custom",
          message: "Informe uma renda válida, maior que zero.",
        });
        return z.NEVER;
      }
      return cents;
    }),
});

const percentageSchema = z
  .number("Percentual inválido.")
  .multipleOf(0.5, "Percentual deve ser em passos de 0,5%.")
  .min(0, "Percentual não pode ser negativo.")
  .max(100, "Percentual não pode ser maior que 100%.");

const budgetClassificationEnum = z.enum(
  ["CUSTOS_OBRIGATORIOS", "PRAZERES_E_CONFORTOS", "INVESTIMENTOS"],
  "Classificação inválida."
);

const allClassificationEnum = z.enum(
  ["RECEITA", "CUSTOS_OBRIGATORIOS", "PRAZERES_E_CONFORTOS", "INVESTIMENTOS", "NEUTRA"],
  "Classificação inválida."
);

// One combined save for the whole edit session (classifications + every
// category touched across them), plus how to apply it — see
// src/app/actions/budget.ts for what "month" vs "default" actually do.
// A Classification no longer has a percentage of its own to validate —
// it's purely the sum of its Categories' percentages (the action
// recomputes and persists that sum itself, ignoring whatever the
// classifications[].percentage the client sent actually says), so the
// only distribution rule left is on the Categories: their percentages,
// all together, must never exceed 100% of income. Reaching exactly
// 100% isn't required to save — an in-progress, partially-distributed
// budget is a perfectly valid thing to persist and keep refining later;
// only overshooting 100% is rejected.
export const budgetDistributionSchema = z
  .object({
    applyScope: z.enum(["month", "default"], "Escolha como aplicar a alteração."),
    monthKey: z.string().refine(isValidMonthKey, { message: "Mês inválido." }),
    classifications: z
      .array(
        z.object({
          classification: budgetClassificationEnum,
          percentage: percentageSchema,
        })
      )
      .min(1, "Informe ao menos uma classificação."),
    categories: z.array(
      z.object({
        categoryId: z.string().min(1, "Categoria inválida."),
        percentage: percentageSchema,
      })
    ),
  })
  .refine((data) => data.categories.reduce((sum, c) => sum + c.percentage, 0) <= 100, {
    message: "A distribuição das categorias não pode ultrapassar 100% da renda.",
    path: ["categories"],
  });

export const monthOverrideSchema = z.object({
  monthKey: z.string().refine(isValidMonthKey, { message: "Mês inválido." }),
});

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome da categoria.")
  .max(60, "Nome muito longo.");

// Shown directly under the category name in Orçamento — required so
// every category (default or user-created) is self-explanatory.
const categoryDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Informe uma descrição.")
  .max(160, "Descrição muito longa.");

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  description: categoryDescriptionSchema,
  type: z.enum(["ENTRADA", "SAIDA", "NEUTRO"], "Tipo inválido."),
  classification: allClassificationEnum,
});

export const updateCategorySchema = z.object({
  id: z.string().min(1, "Categoria inválida."),
  name: categoryNameSchema,
  description: categoryDescriptionSchema,
  classification: allClassificationEnum,
});

export const setCategoryActiveSchema = z.object({
  id: z.string().min(1, "Categoria inválida."),
  isActive: z.boolean(),
});

const paymentMethodNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do meio de pagamento.")
  .max(40, "Nome muito longo.");

export const createPaymentMethodSchema = z.object({ name: paymentMethodNameSchema });
export const updatePaymentMethodSchema = z.object({
  id: z.string().min(1, "Meio de pagamento inválido."),
  name: paymentMethodNameSchema,
});
export const deletePaymentMethodSchema = z.object({
  id: z.string().min(1, "Meio de pagamento inválido."),
});

const tagNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome da tag.")
  .max(40, "Nome muito longo.");

export const createTagSchema = z.object({ name: tagNameSchema });
export const updateTagSchema = z.object({
  id: z.string().min(1, "Tag inválida."),
  name: tagNameSchema,
});
export const deleteTagSchema = z.object({ id: z.string().min(1, "Tag inválida.") });

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  password: z.string().min(1, "Informe sua senha."),
});

// ---- Gestão Patrimonial (src/lib/patrimonio.ts) -------------------------
// Callers pre-normalize FormData into plain objects where an absent/empty
// optional field is `undefined` (never `null`/`""`) — see
// src/app/actions/patrimonio.ts's `f()` helper — so every optional
// schema below can just be `.optional()`.

const patrimonioAssetCategoryEnum = z.enum(
  ["FINANCEIRO", "BEM_MOVEL", "BEM_IMOVEL", "INTANGIVEL", "COLECIONAVEL"],
  "Categoria inválida."
);
const patrimonioLiabilityCategoryEnum = z.enum(
  ["EMPRESTIMO_DIVIDA", "FINANCIAMENTO", "CONSORCIO", "OUTRO"],
  "Categoria inválida."
);
const patrimonioUsageTypeEnum = z.enum(["USO_PESSOAL", "GERADOR_RENDA"], "Tipo inválido.");
const patrimonioLocationEnum = z.enum(["ONSHORE", "OFFSHORE"], "Localização inválida.");
const patrimonioLiquidityEnum = z.enum(["ALTA", "MEDIA", "BAIXA"], "Nível de liquidez inválido.");
const patrimonioUpdateMethodEnum = z.enum(["MANUAL", "PROJECAO_AUTOMATICA"], "Método de atualização inválido.");

const requiredMoneyCentsSchema = z
  .string()
  .min(1, "Informe o valor.")
  .transform((value, ctx) => {
    const cents = parseMoneyToCents(value, { allowZero: true });
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Informe um valor válido." });
      return z.NEVER;
    }
    return cents;
  });

const optionalMoneyCentsSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const cents = parseMoneyToCents(value, { allowZero: true });
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Informe um valor válido." });
      return z.NEVER;
    }
    return cents;
  });

const optionalPercentSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const n = Number(value.replace(",", "."));
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Informe um percentual válido." });
      return z.NEVER;
    }
    return n;
  });

const optionalDateInputSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDateInputValue(value);
    if (!date) {
      ctx.addIssue({ code: "custom", message: "Informe uma data válida." });
      return z.NEVER;
    }
    return date;
  });

function optionalTextSchema(max: number) {
  return z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
    .optional()
    .transform((value) => value ?? null);
}

const optionalBooleanSchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? null : value === "true"));

const requiredBooleanSchema = z
  .enum(["true", "false"], "Selecione uma opção.")
  .transform((value) => value === "true");

// "Tipo" (usageType) is required across all 5 asset categories (spec
// sections 5-9 each list it as obrigatório); Financeiro additionally
// requires "Performance" (rateLabel) and "Localização" — enforced below
// via superRefine since those two are category-conditional, while
// usageType is simply never `.optional()`. Nível de Liquidez stays
// optional everywhere by explicit spec instruction.
export const patrimonioAssetSchema = z
  .object({
    id: z.string().optional(),
    category: patrimonioAssetCategoryEnum,
    name: z.string().trim().min(1, "Informe a descrição."),
    currentValueCents: requiredMoneyCentsSchema,
    usageType: patrimonioUsageTypeEnum,
    location: patrimonioLocationEnum.optional(),
    liquidity: patrimonioLiquidityEnum.optional(),
    updateMethod: patrimonioUpdateMethodEnum,
    annualRatePct: optionalPercentSchema,
    rateLabel: optionalTextSchema(80),
    purchaseDate: optionalDateInputSchema,
    purchaseValueCents: optionalMoneyCentsSchema,
    isRented: optionalBooleanSchema,
    rentNetValueCents: optionalMoneyCentsSchema,
    notes: optionalTextSchema(500),
  })
  .superRefine((data, ctx) => {
    if (data.category !== "FINANCEIRO") return;
    if (!data.location) {
      ctx.addIssue({ code: "custom", path: ["location"], message: "Informe a localização." });
    }
    if (!data.rateLabel) {
      ctx.addIssue({ code: "custom", path: ["rateLabel"], message: "Informe a performance/índice." });
    }
  });

// "Crédito da Carta" (creditValueCents) is required for Consórcio only
// (spec section 12) — every other field here stays optional across all
// 4 categories, enforced via superRefine below rather than a second
// schema per category.
export const patrimonioLiabilitySchema = z
  .object({
    id: z.string().optional(),
    category: patrimonioLiabilityCategoryEnum,
    name: z.string().trim().min(1, "Informe a descrição."),
    currentBalanceCents: requiredMoneyCentsSchema,
    installmentValueCents: optionalMoneyCentsSchema,
    remainingInstallments: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (!value) return null;
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) {
          ctx.addIssue({ code: "custom", message: "Informe um número válido." });
          return z.NEVER;
        }
        return n;
      }),
    amortization: optionalTextSchema(60),
    cetPct: optionalPercentSchema,
    correctionIndex: optionalTextSchema(60),
    administrationFeePct: optionalPercentSchema,
    creditValueCents: optionalMoneyCentsSchema,
    liabilityType: optionalTextSchema(60),
    linkedAssetId: z
      .string()
      .optional()
      .transform((value) => value ?? null),
    startDate: optionalDateInputSchema,
    expectedEndDate: optionalDateInputSchema,
    dueDate: optionalDateInputSchema,
    notes: optionalTextSchema(500),
  })
  .superRefine((data, ctx) => {
    if (data.category === "CONSORCIO" && data.creditValueCents == null) {
      ctx.addIssue({ code: "custom", path: ["creditValueCents"], message: "Informe o crédito da carta." });
    }
  });

export const patrimonioProtectionSchema = z.object({
  id: z.string().optional(),
  element: z.string().trim().min(1, "Informe o elemento."),
  objective: optionalTextSchema(300),
  currentValueCents: optionalMoneyCentsSchema,
  idealValueCents: optionalMoneyCentsSchema,
  isNeeded: requiredBooleanSchema,
  isCovered: requiredBooleanSchema,
  notes: optionalTextSchema(500),
});

export const patrimonioSetActiveSchema = z.object({
  id: z.string().min(1, "Item inválido."),
  isActive: z.enum(["true", "false"], "Valor inválido.").transform((value) => value === "true"),
});

export const patrimonioConfirmMonthlyValueSchema = z.object({
  kind: z.enum(["asset", "liability"], "Tipo inválido."),
  itemId: z.string().min(1, "Item inválido."),
  monthKey: z.string().refine(isValidMonthKey, { message: "Mês inválido." }),
  valueCents: requiredMoneyCentsSchema,
});
