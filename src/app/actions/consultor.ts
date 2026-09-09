"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getSession, startImpersonation, stopImpersonation } from "@/lib/session";
import { requireRole, requireOwnClient, homeForRole } from "@/lib/rbac";
import { DEFAULT_CATEGORY_TEMPLATE } from "@/lib/default-categories";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/default-payment-methods";
import { newClientSchema } from "@/lib/validation";

export type ConsultorActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

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
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
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
  const cliente = await prisma.user.create({
    data: {
      name,
      email,
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
