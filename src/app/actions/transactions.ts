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

function formType(formData: FormData): "ENTRADA" | "SAIDA" | "NEUTRO" {
  const value = formData.get("type");
  if (value === "SAIDA") return "SAIDA";
  if (value === "NEUTRO") return "NEUTRO";
  return "ENTRADA";
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
  type: "ENTRADA" | "SAIDA" | "NEUTRO",
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

// Both Meio de Pagamento and Tag are optional — an empty id just means
// "none selected", never trusted blindly: a non-empty id must resolve
// to a record this user actually owns, or the field is rejected.
type OptionalRefResult = { ok: true; id: string | null } | { ok: false };

async function resolvePaymentMethodId(id: string, userId: string): Promise<OptionalRefResult> {
  if (!id) return { ok: true, id: null };
  const paymentMethod = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!paymentMethod || paymentMethod.userId !== userId) return { ok: false };
  return { ok: true, id: paymentMethod.id };
}

async function resolveTagId(id: string, userId: string): Promise<OptionalRefResult> {
  if (!id) return { ok: true, id: null };
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag || tag.userId !== userId) return { ok: false };
  return { ok: true, id: tag.id };
}

export async function createTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const userId = await requireUserId();

  const type = formType(formData);

  const parsed = transactionSchema.safeParse({
    type,
    amountCents: formString(formData, "amountCents"),
    description: formString(formData, "description"),
    categoryId: formString(formData, "categoryId"),
    paymentMethodId: formString(formData, "paymentMethodId"),
    tagId: formString(formData, "tagId"),
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

  const paymentMethod = await resolvePaymentMethodId(parsed.data.paymentMethodId ?? "", userId);
  if (!paymentMethod.ok) {
    return {
      error: "Selecione um meio de pagamento válido.",
      fieldErrors: { paymentMethodId: ["Selecione um meio de pagamento válido."] },
    };
  }

  const tag = await resolveTagId(parsed.data.tagId ?? "", userId);
  if (!tag.ok) {
    return {
      error: "Selecione uma tag válida.",
      fieldErrors: { tagId: ["Selecione uma tag válida."] },
    };
  }

  await prisma.transaction.create({
    data: {
      userId,
      type: parsed.data.type,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description || null,
      categoryId: category.id,
      classification: category.classification,
      paymentMethodId: paymentMethod.id,
      tagId: tag.id,
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

  const type = formType(formData);

  const parsed = transactionSchema.safeParse({
    type,
    amountCents: formString(formData, "amountCents"),
    description: formString(formData, "description"),
    categoryId: formString(formData, "categoryId"),
    paymentMethodId: formString(formData, "paymentMethodId"),
    tagId: formString(formData, "tagId"),
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

  const paymentMethod = await resolvePaymentMethodId(parsed.data.paymentMethodId ?? "", userId);
  if (!paymentMethod.ok) {
    return {
      error: "Selecione um meio de pagamento válido.",
      fieldErrors: { paymentMethodId: ["Selecione um meio de pagamento válido."] },
    };
  }

  const tag = await resolveTagId(parsed.data.tagId ?? "", userId);
  if (!tag.ok) {
    return {
      error: "Selecione uma tag válida.",
      fieldErrors: { tagId: ["Selecione uma tag válida."] },
    };
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      type: parsed.data.type,
      amountCents: parsed.data.amountCents,
      description: parsed.data.description || null,
      categoryId: category.id,
      classification: category.classification,
      paymentMethodId: paymentMethod.id,
      tagId: tag.id,
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
