"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validation";
import {
  formString,
  formType,
  requireUserId,
  resolveCategory,
  resolvePaymentMethodId,
  resolveTagId,
} from "@/lib/transaction-resolvers";

export type TransactionActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

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
      // A manually-entered transaction always represents something the
      // user is registering as a fact, regardless of its date — never
      // a prediction. Only series-generated occurrences (src/lib/
      // series.ts) are ever created as NAO_PAGO.
      status: "PAGO",
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

  // A plain edit of a normal (series-less) transaction never touches
  // status/seriesId — those only change through the series-aware
  // actions in src/app/actions/series.ts. Editing a series occurrence
  // "somente esta" also lands here (same shape as a normal edit), so
  // status/seriesId/installmentNumber are simply left untouched by
  // omitting them from `data` below.
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

export async function markTransactionPaidStatusAction(formData: FormData) {
  const userId = await requireUserId();

  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || !id || (status !== "PAGO" && status !== "NAO_PAGO")) {
    return;
  }

  await prisma.transaction.updateMany({
    where: { id, userId },
    data: { status },
  });

  revalidatePath("/lancamentos");
}
