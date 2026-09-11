"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getSession, startImpersonation, stopImpersonation } from "@/lib/session";
import { requireRole, requireOwnClient, homeForRole } from "@/lib/rbac";
import { DEFAULT_CATEGORY_TEMPLATE } from "@/lib/default-categories";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/default-payment-methods";
import { newClientSchema, updateClientProfileSchema, resetUserPasswordSchema } from "@/lib/validation";
import type { UserStatus } from "@/generated/prisma/enums";

export type ConsultorActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

// A CONSULTOR may only park their own cliente as ATIVO/INATIVO —
// BLOQUEADO is reserved for an ADMIN (see setClientStatusAction below).
const CONSULTOR_ALLOWED_STATUSES: UserStatus[] = ["ATIVO", "INATIVO"];
const ALL_STATUSES: UserStatus[] = ["ATIVO", "INATIVO", "BLOQUEADO"];

/** Same shape as registerAction (src/app/actions/auth.ts): create the
 * User, seed the exact same starter categories/payment methods a
 * self-registered cliente gets — just with role: CLIENTE and
 * consultorId set, and no session/redirect (the consultor stays on
 * Clientes; the cliente logs in on their own later with the password
 * just set here). Reachable by ADMIN too (an admin creating a cliente
 * directly, unassigned to any consultor, is the only case
 * `consultorId` ends up null here). */
export async function createClientAction(
  _prevState: ConsultorActionState,
  formData: FormData
): Promise<ConsultorActionState> {
  const session = await requireRole("CONSULTOR", "ADMIN");

  const parsed = newClientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
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
  const cliente = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      role: "CLIENTE",
      consultorId: session.role === "CONSULTOR" ? session.realUserId : null,
    },
  });

  await prisma.category.createMany({
    data: DEFAULT_CATEGORY_TEMPLATE.map((c) => ({ ...c, userId: cliente.id })),
  });
  await prisma.paymentMethod.createMany({
    data: DEFAULT_PAYMENT_METHODS.map((pm) => ({ ...pm, userId: cliente.id })),
  });

  revalidatePath("/consultor/clientes");
  revalidatePath("/admin/clientes");
  return { success: true };
}

/** Used by both the Consultor's "Entrar"/"Visualizar" on their own
 * Clientes table and the Admin's "Acessar" on the global Clientes list
 * — requireOwnClient allows an ADMIN unconditionally and a CONSULTOR
 * only for their own portfolio (src/lib/rbac.ts), so this one action
 * covers both without duplicating the impersonation-start logic. */
export async function startImpersonationAction(formData: FormData) {
  const session = await requireRole("CONSULTOR", "ADMIN");
  const clienteId = formData.get("clienteId");
  if (typeof clienteId !== "string" || !clienteId) {
    throw new Error("Cliente inválido.");
  }
  await requireOwnClient(session, clienteId);
  await startImpersonation(session.realUserId, clienteId);
  redirect("/dashboard");
}

export async function stopImpersonationAction() {
  const session = await getSession();
  await stopImpersonation();
  redirect(session ? homeForRole(session.role) : "/login");
}

/** "Editar" on the Consultor's own Clientes table and the Admin's
 * global one — requireOwnClient gives the same CONSULTOR-own-portfolio-
 * only / ADMIN-any-cliente split every other cliente-targeting action
 * here uses. Unlike createClientAction/startImpersonationAction this
 * never touches the cliente's own session, so it's logged directly
 * (not through logAudit, which is a no-op outside of impersonation —
 * this edit happens from the Consultor/Admin's own environment, not
 * while "atuando como" the cliente, but the spec still wants it on
 * record). */
export async function updateClientProfileAction(
  _prevState: ConsultorActionState,
  formData: FormData
): Promise<ConsultorActionState> {
  const session = await requireRole("CONSULTOR", "ADMIN");

  const parsed = updateClientProfileSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { id, name, email } = parsed.data;

  await requireOwnClient(session, id);

  const cliente = await prisma.user.findUnique({ where: { id } });
  if (!cliente || cliente.role !== "CLIENTE") {
    return { error: "Cliente não encontrado." };
  }

  if (email !== cliente.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        error: "Este e-mail já está cadastrado.",
        fieldErrors: { email: ["Este e-mail já está cadastrado."] },
      };
    }
  }

  await prisma.user.update({ where: { id }, data: { name, email } });

  await prisma.auditLog.create({
    data: {
      consultorId: session.realUserId,
      clienteId: id,
      action: "cliente.updateProfile",
      entityType: "User",
      entityId: id,
      previousValue: { name: cliente.name, email: cliente.email },
      newValue: { name, email },
    },
  });

  revalidatePath("/consultor/clientes");
  revalidatePath("/admin/clientes");
  return { success: true };
}

/** "Status da conta" control on the Consultor's own Clientes table and
 * the Admin's global one — same requireOwnClient split as every other
 * cliente-targeting action here. A CONSULTOR is restricted to
 * ATIVO/INATIVO server-side too (never trusts the <select> alone —
 * see CONSULTOR_ALLOWED_STATUSES above); an ADMIN may set any of the
 * three. */
export async function setClientStatusAction(formData: FormData) {
  const session = await requireRole("CONSULTOR", "ADMIN");

  const id = formData.get("id");
  const status = formData.get("status");
  const allowed = session.role === "ADMIN" ? ALL_STATUSES : CONSULTOR_ALLOWED_STATUSES;
  if (typeof id !== "string" || !id || typeof status !== "string" || !allowed.includes(status as UserStatus)) {
    throw new Error("Cliente ou status inválido.");
  }

  await requireOwnClient(session, id);

  await prisma.user.update({ where: { id }, data: { status: status as UserStatus } });
  revalidatePath("/consultor/clientes");
  revalidatePath("/admin/clientes");
}

/** "Redefinir senha" on the Consultor's own Clientes table and the
 * Admin's global one — same requireOwnClient split. No current-password
 * check: the superior, not the account owner, is doing this. */
export async function resetClientPasswordAction(
  _prevState: ConsultorActionState,
  formData: FormData
): Promise<ConsultorActionState> {
  const session = await requireRole("CONSULTOR", "ADMIN");

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

  await requireOwnClient(session, id);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  return { success: true };
}
