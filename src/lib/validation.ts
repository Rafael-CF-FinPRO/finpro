import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";
import { isValidMonthKey, parseDateInputValue } from "@/lib/dates";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome completo."),
    email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
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

// A recurring series reuses every field transactionSchema already
// validates (the "date" field becomes the first occurrence's date) and
// adds only what's specific to recurrence — periodicity, and an
// optional end date. An empty endDate means open-ended (see
// src/lib/series.ts's rolling top-up).
export const recurringSeriesSchema = z
  .object({
    ...transactionSchema.shape,
    periodicity: z.enum(["MENSAL"], "Periodicidade inválida."),
    endDate: z
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
      }),
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
  installmentCount: z
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
    }),
});

// "Alterar/excluir só esta ocorrência" vs "esta e as próximas ainda
// não pagas" — see src/lib/transaction-labels.ts's SeriesEditScope.
export const seriesEditScopeSchema = z.enum(["this", "this_and_future"], "Escolha inválida.");

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
  .int("Percentual inválido.")
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
export const budgetDistributionSchema = z.object({
  applyScope: z.enum(["month", "default"], "Escolha como aplicar a alteração."),
  monthKey: z.string().refine(isValidMonthKey, { message: "Mês inválido." }),
  classifications: z
    .array(
      z.object({
        classification: budgetClassificationEnum,
        percentage: percentageSchema,
      })
    )
    .min(1, "Informe ao menos uma classificação.")
    .refine((items) => items.reduce((sum, item) => sum + item.percentage, 0) === 100, {
      message: "As classificações precisam totalizar 100%.",
    }),
  categories: z.array(
    z.object({
      categoryId: z.string().min(1, "Categoria inválida."),
      percentage: percentageSchema,
    })
  ),
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

export const forgotPasswordSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
