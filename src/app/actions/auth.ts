"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { DEFAULT_CATEGORY_TEMPLATE } from "@/lib/default-categories";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
  devResetLink?: string;
};

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, email, password } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      error: "Este e-mail já está cadastrado.",
      fieldErrors: { email: ["Este e-mail já está cadastrado."] },
    };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  // Give the new user their own starting set of categories (see
  // src/lib/default-categories.ts — provisional list, editable by the
  // user afterwards).
  await prisma.category.createMany({
    data: DEFAULT_CATEGORY_TEMPLATE.map((c) => ({ ...c, userId: user.id })),
  });

  await createSession(user.id);
  redirect("/dashboard");
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const genericError = "E-mail ou senha inválidos.";

  if (!user) {
    return { error: genericError };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: genericError };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email } = parsed.data;
  const genericMessage =
    "Se este e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.";

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Avoid leaking whether an email is registered.
    return { success: true, message: genericMessage };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  const resetLink = `/reset-password?token=${token}`;
  // No e-mail provider is configured yet in this stage, so the link is
  // logged for local testing instead of being delivered by e-mail.
  console.log(`[FinPRO] Link de recuperação de senha para ${email}: ${resetLink}`);

  return {
    success: true,
    message: genericMessage,
    devResetLink: process.env.NODE_ENV !== "production" ? resetLink : undefined,
  };
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { token, password } = parsed.data;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  const invalidTokenError =
    "Link inválido ou expirado. Solicite uma nova recuperação de senha.";

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt.getTime() < Date.now()
  ) {
    return { error: invalidTokenError };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  redirect("/login?reset=success");
}
