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
  type: z.enum(["ENTRADA", "SAIDA"], "Tipo inválido."),
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
    .min(1, "Informe uma descrição.")
    .max(120, "Descrição muito longa."),
  categoryId: z.string().min(1, "Selecione uma categoria."),
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
  ["CUSTOS_OBRIGATORIOS", "CONFORTOS", "PRAZERES", "INVESTIMENTOS", "CONHECIMENTO", "METAS"],
  "Classificação inválida."
);

const allClassificationEnum = z.enum(
  ["RECEITA", "CUSTOS_OBRIGATORIOS", "CONFORTOS", "PRAZERES", "INVESTIMENTOS", "CONHECIMENTO", "METAS"],
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

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  type: z.enum(["ENTRADA", "SAIDA"], "Tipo inválido."),
  classification: allClassificationEnum,
});

export const updateCategorySchema = z.object({
  id: z.string().min(1, "Categoria inválida."),
  name: categoryNameSchema,
  classification: allClassificationEnum,
});

export const setCategoryActiveSchema = z.object({
  id: z.string().min(1, "Categoria inválida."),
  isActive: z.boolean(),
});

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
