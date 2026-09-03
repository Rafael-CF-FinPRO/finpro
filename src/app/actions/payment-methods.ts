"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  createPaymentMethodSchema,
  deletePaymentMethodSchema,
  updatePaymentMethodSchema,
} from "@/lib/validation";

export type PaymentMethodActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  paymentMethod?: { id: string; name: string };
};

async function requireUserId() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.userId;
}

// Used both from Configurações and from the "add new" flow inline in
// the Lançamentos transaction form — returning the created record lets
// the form select it immediately without waiting for a page reload.
export async function createPaymentMethodAction(input: {
  name: string;
}): Promise<PaymentMethodActionState> {
  const userId = await requireUserId();

  const parsed = createPaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique o nome informado.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await prisma.paymentMethod.findFirst({
    where: { userId, name: parsed.data.name },
  });
  if (existing) {
    return {
      error: "Você já tem um meio de pagamento com esse nome.",
      fieldErrors: { name: ["Você já tem um meio de pagamento com esse nome."] },
    };
  }

  const maxOrder = await prisma.paymentMethod.aggregate({
    where: { userId },
    _max: { order: true },
  });

  const paymentMethod = await prisma.paymentMethod.create({
    data: { userId, name: parsed.data.name, order: (maxOrder._max.order ?? 0) + 1 },
  });

  revalidatePath("/lancamentos");
  revalidatePath("/configuracoes");
  return { success: true, paymentMethod: { id: paymentMethod.id, name: paymentMethod.name } };
}

// Configurações only — Lançamentos can only create, never rename.
export async function updatePaymentMethodAction(input: {
  id: string;
  name: string;
}): Promise<PaymentMethodActionState> {
  const userId = await requireUserId();

  const parsed = updatePaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const paymentMethod = await prisma.paymentMethod.findUnique({ where: { id: parsed.data.id } });
  if (!paymentMethod || paymentMethod.userId !== userId) {
    return { error: "Meio de pagamento não encontrado." };
  }

  const duplicate = await prisma.paymentMethod.findFirst({
    where: { userId, name: parsed.data.name, id: { not: paymentMethod.id } },
  });
  if (duplicate) {
    return {
      error: "Você já tem um meio de pagamento com esse nome.",
      fieldErrors: { name: ["Você já tem um meio de pagamento com esse nome."] },
    };
  }

  await prisma.paymentMethod.update({
    where: { id: paymentMethod.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/lancamentos");
  revalidatePath("/configuracoes");
  return { success: true };
}

// Configurações only. Real delete, not a soft-delete — safe because the
// Transaction.paymentMethodId FK is ON DELETE SET NULL: any historical
// transaction just loses the label, its amount/date/description/
// category are never touched.
export async function deletePaymentMethodAction(input: {
  id: string;
}): Promise<PaymentMethodActionState> {
  const userId = await requireUserId();

  const parsed = deletePaymentMethodSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Meio de pagamento inválido." };
  }

  const paymentMethod = await prisma.paymentMethod.findUnique({ where: { id: parsed.data.id } });
  if (!paymentMethod || paymentMethod.userId !== userId) {
    return { error: "Meio de pagamento não encontrado." };
  }

  await prisma.paymentMethod.delete({ where: { id: paymentMethod.id } });

  revalidatePath("/lancamentos");
  revalidatePath("/configuracoes");
  return { success: true };
}
