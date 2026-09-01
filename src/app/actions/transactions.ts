"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { transactionSchema } from "@/lib/validation";

export type TransactionActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireUserId() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.userId;
}

async function resolveCategory(
  categoryId: string,
  type: "ENTRADA" | "SAIDA",
  userId: string
) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!category || category.type !== type || category.userId !== userId) {
    return null;
  }
  return category;
}

export async function createTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const userId = await requireUserId();

  const type = formData.get("type") === "SAIDA" ? "SAIDA" : "ENTRADA";

  const parsed = transactionSchema.safeParse({
    type,
    amountCents: formString(formData, "amountCents"),
    description: formString(formData, "description"),
    categoryId: formString(formData, "categoryId"),
    date: formString(formData, "date"),
    note: formString(formData, "note"),
  });

  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const category = await resolveCategory(parsed.data.categoryId, parsed.data.type, userId);
  if (!category) {
    return {
      error: "Selecione uma categoria válida.",
      fieldErrors: { categoryId: ["Selecione uma categoria válida."] },
    };
  }

  await prisma.transaction.create({
    data: {
      userId,
      type: parsed.data.type,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description,
      categoryId: category.id,
      classification: category.classification,
      date: parsed.data.date,
      note: parsed.data.note || null,
    },
  });

  revalidatePath("/lancamentos");
  return { success: true };
}

export async function updateTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const userId = await requireUserId();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Lançamento inválido." };
  }

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return { error: "Lançamento não encontrado." };
  }

  const type = formData.get("type") === "SAIDA" ? "SAIDA" : "ENTRADA";

  const parsed = transactionSchema.safeParse({
    type,
    amountCents: formString(formData, "amountCents"),
    description: formString(formData, "description"),
    categoryId: formString(formData, "categoryId"),
    date: formString(formData, "date"),
    note: formString(formData, "note"),
  });

  if (!parsed.success) {
    return {
      error: "Verifique os campos informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const category = await resolveCategory(parsed.data.categoryId, parsed.data.type, userId);
  if (!category) {
    return {
      error: "Selecione uma categoria válida.",
      fieldErrors: { categoryId: ["Selecione uma categoria válida."] },
    };
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      type: parsed.data.type,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description,
      categoryId: category.id,
      classification: category.classification,
      date: parsed.data.date,
      note: parsed.data.note || null,
    },
  });

  revalidatePath("/lancamentos");
  return { success: true };
}

export async function deleteTransactionAction(formData: FormData) {
  const userId = await requireUserId();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return;
  }

  await prisma.transaction.deleteMany({
    where: { id, userId },
  });

  revalidatePath("/lancamentos");
}
