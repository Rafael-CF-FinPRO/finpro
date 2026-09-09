"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireRole } from "@/lib/rbac";
import { newConsultorSchema } from "@/lib/validation";

export type AdminActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

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
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "Este e-mail já está cadastrado.",
      fieldErrors: { email: ["Este e-mail já está cadastrado."] },
    };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { name, email, passwordHash, role: "CONSULTOR" },
  });

  revalidatePath("/admin/consultores");
  return { success: true };
}

export async function toggleConsultorActiveAction(formData: FormData) {
  await requireRole("ADMIN");

  const id = formData.get("id");
  const nextIsActive = formData.get("nextIsActive");
  if (typeof id !== "string" || !id || typeof nextIsActive !== "string") {
    throw new Error("Consultor inválido.");
  }

  const consultor = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!consultor || consultor.role !== "CONSULTOR") {
    throw new Error("Consultor inválido.");
  }

  await prisma.user.update({ where: { id }, data: { isActive: nextIsActive === "true" } });
  revalidatePath("/admin/consultores");
}
