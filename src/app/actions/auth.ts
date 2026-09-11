"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { homeForRole } from "@/lib/rbac";
import { loginSchema } from "@/lib/validation";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  message?: string;
};

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

  if (!user || user.status !== "ATIVO") {
    return { error: genericError };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { error: genericError };
  }

  // Only a real, direct login touches this — never a CONSULTOR/ADMIN
  // impersonating the account — so it reflects the CLIENTE's own actual
  // usage for src/lib/consultor.ts's "dias desde o último acesso".
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  await createSession(user.id);
  redirect(homeForRole(user.role));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
