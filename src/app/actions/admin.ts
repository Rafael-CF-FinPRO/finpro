"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireRole } from "@/lib/rbac";
import {
  newConsultorSchema,
  updateConsultorProfileSchema,
  resetUserPasswordSchema,
} from "@/lib/validation";
import type { UserStatus } from "@/generated/prisma/enums";

export type AdminActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

const USER_STATUSES: UserStatus[] = ["ATIVO", "INATIVO", "BLOQUEADO"];

/** Same shape as createClientAction (src/app/actions/consultor.ts), just
 * role: CONSULTOR and no starter categories/payment methods to seed — a
 * Consultor doesn't have its own Lançamentos/Orçamento, so there's
 * nothing to seed. */
export async function createConsultorAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = newConsultorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { name, email, phone, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "Este e-mail já está cadastrado.",
      fieldErrors: { email: ["Este e-mail já está cadastrado."] },
    };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { name, email, phone: phone || null, passwordHash, role: "CONSULTOR" },
  });

  revalidatePath("/admin/consultores");
  return { success: true };
}

export async function updateConsultorProfileAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = updateConsultorProfileSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { id, name, email } = parsed.data;

  const consultor = await prisma.user.findUnique({ where: { id } });
  if (!consultor || consultor.role !== "CONSULTOR") {
    return { error: "Consultor não encontrado." };
  }

  if (email !== consultor.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        error: "Este e-mail já está cadastrado.",
        fieldErrors: { email: ["Este e-mail já está cadastrado."] },
      };
    }
  }

  await prisma.user.update({ where: { id }, data: { name, email } });

  revalidatePath("/admin/consultores");
  return { success: true };
}

export async function setConsultorStatusAction(formData: FormData) {
  await requireRole("ADMIN");

  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || !id || typeof status !== "string" || !USER_STATUSES.includes(status as UserStatus)) {
    throw new Error("Consultor inválido.");
  }

  const consultor = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!consultor || consultor.role !== "CONSULTOR") {
    throw new Error("Consultor inválido.");
  }

  await prisma.user.update({ where: { id }, data: { status: status as UserStatus } });
  revalidatePath("/admin/consultores");
}

/** Only an ADMIN resets a CONSULTOR's password — no one else manages
 * consultor accounts. No current-password check: the superior, not the
 * account owner, is doing this (same reasoning as resetClientPasswordAction
 * in src/app/actions/consultor.ts). */
export async function resetConsultorPasswordAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireRole("ADMIN");

  const parsed = resetUserPasswordSchema.safeParse({
    id: formData.get("id"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });
  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { id, newPassword } = parsed.data;

  const consultor = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!consultor || consultor.role !== "CONSULTOR") {
    return { error: "Consultor não encontrado." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  return { success: true };
}
