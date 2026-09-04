"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  installmentSeriesSchema,
  recurringSeriesSchema,
  seriesEditScopeSchema,
  transactionSchema,
} from "@/lib/validation";
import {
  formString,
  formType,
  requireUserId,
  resolveCategory,
  resolvePaymentMethodId,
  resolveTagId,
} from "@/lib/transaction-resolvers";
import { buildInitialRecurringRows, buildInstallmentRows } from "@/lib/series";
import type { TransactionActionState } from "./transactions";

export async function createRecurringSeriesAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const userId = await requireUserId();
  const type = formType(formData);

  const parsed = recurringSeriesSchema.safeParse({
    type,
    amountCents: formString(formData, "amountCents"),
    description: formString(formData, "description"),
    categoryId: formString(formData, "categoryId"),
    paymentMethodId: formString(formData, "paymentMethodId"),
    tagId: formString(formData, "tagId"),
    date: formString(formData, "date"),
    note: formString(formData, "note"),
    periodicity: formString(formData, "periodicity") || "MENSAL",
    endDate: formString(formData, "endDate"),
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

  const series = await prisma.transactionSeries.create({
    data: {
      userId,
      seriesType: "RECORRENTE",
      type: parsed.data.type,
      categoryId: category.id,
      classification: category.classification,
      description: parsed.data.description || null,
      paymentMethodId: paymentMethod.id,
      tagId: tag.id,
      note: parsed.data.note || null,
      amountCents: parsed.data.amountCents,
      periodicity: parsed.data.periodicity,
      startDate: parsed.data.date,
      endDate: parsed.data.endDate,
    },
  });

  const rows = buildInitialRecurringRows(series);
  if (rows.length > 0) {
    await prisma.transaction.createMany({ data: rows });
    await prisma.transactionSeries.update({
      where: { id: series.id },
      data: { generatedUntil: rows[rows.length - 1].date },
    });
  }

  revalidatePath("/lancamentos");
  return { success: true };
}

export async function createInstallmentSeriesAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const userId = await requireUserId();
  const type = formType(formData);

  const parsed = installmentSeriesSchema.safeParse({
    type,
    amountCents: formString(formData, "amountCents"),
    description: formString(formData, "description"),
    categoryId: formString(formData, "categoryId"),
    paymentMethodId: formString(formData, "paymentMethodId"),
    tagId: formString(formData, "tagId"),
    date: formString(formData, "date"),
    note: formString(formData, "note"),
    installmentCount: formString(formData, "installmentCount"),
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

  const series = await prisma.transactionSeries.create({
    data: {
      userId,
      seriesType: "PARCELADO",
      type: parsed.data.type,
      categoryId: category.id,
      classification: category.classification,
      description: parsed.data.description || null,
      paymentMethodId: paymentMethod.id,
      tagId: tag.id,
      note: parsed.data.note || null,
      amountCents: parsed.data.amountCents,
      installmentCount: parsed.data.installmentCount,
      startDate: parsed.data.date,
    },
  });

  const rows = buildInstallmentRows(series);
  await prisma.transaction.createMany({ data: rows });

  revalidatePath("/lancamentos");
  return { success: true };
}

// "this" behaves exactly like a normal single-row edit. "this_and_future"
// additionally touches every NOT-YET-PAID future occurrence of the same
// series (never a paid/realized one — see Teste 13/15) with the shared
// fields; amountCents is only propagated for a RECORRENTE series, since
// bulk-changing every future parcela's value would break the fixed
// per-installment amount a PARCELADO series was created with.
export async function updateSeriesOccurrenceAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const userId = await requireUserId();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Lançamento inválido." };
  }

  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { series: true },
  });
  if (!existing || existing.userId !== userId) {
    return { error: "Lançamento não encontrado." };
  }
  if (!existing.seriesId || !existing.series) {
    return { error: "Este lançamento não pertence a uma série." };
  }

  const scopeParsed = seriesEditScopeSchema.safeParse(formString(formData, "scope"));
  const scope = scopeParsed.success ? scopeParsed.data : "this";

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

  const sharedFields = {
    type: parsed.data.type,
    description: parsed.data.description || null,
    categoryId: category.id,
    classification: category.classification,
    paymentMethodId: paymentMethod.id,
    tagId: tag.id,
    note: parsed.data.note || null,
  };

  await prisma.transaction.update({
    where: { id },
    data: { ...sharedFields, amountCents: parsed.data.amountCents, date: parsed.data.date },
  });

  if (scope === "this_and_future") {
    const propagateAmount = existing.series.seriesType === "RECORRENTE";

    await prisma.transaction.updateMany({
      where: { seriesId: existing.seriesId, status: "NAO_PAGO", date: { gt: existing.date } },
      data: propagateAmount ? { ...sharedFields, amountCents: parsed.data.amountCents } : sharedFields,
    });

    await prisma.transactionSeries.update({
      where: { id: existing.seriesId },
      data: {
        categoryId: category.id,
        classification: category.classification,
        description: sharedFields.description,
        paymentMethodId: paymentMethod.id,
        tagId: tag.id,
        note: sharedFields.note,
        ...(propagateAmount ? { amountCents: parsed.data.amountCents } : {}),
      },
    });
  }

  revalidatePath("/lancamentos");
  return { success: true };
}

// "this" deletes only the selected row. "this_and_future" also deletes
// every not-yet-paid future occurrence of the series and marks the
// series inactive (stops recurring top-up; for parcelado just records
// that it was cut short) — already-paid/realized occurrences, past or
// future, are never touched (Teste 12/14 of the spec).
export async function deleteSeriesOccurrenceAction(formData: FormData) {
  const userId = await requireUserId();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return;

  const scope = formData.get("scope") === "this_and_future" ? "this_and_future" : "this";

  if (scope === "this_and_future" && existing.seriesId) {
    await prisma.transaction.deleteMany({
      where: { seriesId: existing.seriesId, status: "NAO_PAGO", date: { gt: existing.date } },
    });
    await prisma.transaction.deleteMany({ where: { id, userId } });
    await prisma.transactionSeries.update({
      where: { id: existing.seriesId },
      data: { isActive: false },
    });
  } else {
    await prisma.transaction.deleteMany({ where: { id, userId } });
  }

  revalidatePath("/lancamentos");
}
