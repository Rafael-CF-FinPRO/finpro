import { z } from "zod";
import { parseMoneyToCents } from "@/lib/money";
import { parseDateInputValue } from "@/lib/dates";

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
