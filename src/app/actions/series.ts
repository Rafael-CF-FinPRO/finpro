"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  installmentSeriesSchema,
  recurringSeriesSchema,
  seriesEditScopeSchema,
  transactionSchema,
  updateInstallmentCountSchema,
  updateRecurrenceEndDateSchema,
} from "@/lib/validation";
import {
  formString,
  formType,
  requireUserId,
  resolveCategory,
  resolvePaymentMethodId,
  resolveTagId,
} from "@/lib/transaction-resolvers";
import { addMonthsClamped } from "@/lib/dates";
import { buildInitialRecurringRows, buildInstallmentRows, buildRecurringRows, defaultHorizonDate } from "@/lib/series";
import type { TransactionActionState } from "./transactions";

export type SeriesSettingsActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

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

// Turns an existing NORMAL (series-less) transaction into the first
// occurrence of a brand-new RECORRENTE série — only reachable from
// editing that transaction (src/components/lancamentos/TransactionForm.tsx),
// never from creation. The transaction is updated in place (id/history
// preserved) rather than deleted and recreated; its `status` is left
// untouched since a manually-entered transaction is always PAGO
// already, exactly right for an occurrence dated on/before today. Only
// the REMAINING occurrences (after this one) are generated.
export async function convertToRecurringSeriesAction(
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
  if (existing.seriesId) {
    return { error: "Este lançamento já pertence a uma série." };
  }

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
    return { error: "Selecione uma tag válida.", fieldErrors: { tagId: ["Selecione uma tag válida."] } };
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

  await prisma.transaction.update({
    where: { id },
    data: {
      seriesId: series.id,
      installmentNumber: null,
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

  const remainingRows = buildRecurringRows(
    series,
    addMonthsClamped(series.startDate, 1),
    defaultHorizonDate(),
    new Date()
  );
  if (remainingRows.length > 0) {
    await prisma.transaction.createMany({ data: remainingRows });
    await prisma.transactionSeries.update({
      where: { id: series.id },
      data: { generatedUntil: remainingRows[remainingRows.length - 1].date },
    });
  }

  revalidatePath("/lancamentos");
  return { success: true };
}

// Same idea as convertToRecurringSeriesAction, for PARCELADO — the
// existing transaction becomes installment 1/N.
export async function convertToInstallmentSeriesAction(
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
  if (existing.seriesId) {
    return { error: "Este lançamento já pertence a uma série." };
  }

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
    return { error: "Selecione uma tag válida.", fieldErrors: { tagId: ["Selecione uma tag válida."] } };
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

  await prisma.transaction.update({
    where: { id },
    data: {
      seriesId: series.id,
      installmentNumber: 1,
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

  const remainingRows = buildInstallmentRows(series).filter((row) => (row.installmentNumber ?? 0) > 1);
  if (remainingRows.length > 0) {
    await prisma.transaction.createMany({ data: remainingRows });
  }

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

// Adjusts an EXISTING série's own structural settings — RECORRENTE's
// endDate ("Repetir até") or PARCELADO's installmentCount — never the
// per-occurrence shared fields updateSeriesOccurrenceAction handles.
// Always a whole-série change: there's no "somente este" equivalent for
// "quantas parcelas" or "até quando repete". Never touches a PAGO
// occurrence, mirroring the this_and_future rule everywhere else.
export async function updateSeriesSettingsAction(
  _prevState: SeriesSettingsActionState,
  formData: FormData
): Promise<SeriesSettingsActionState> {
  const userId = await requireUserId();

  const seriesId = formString(formData, "seriesId");
  const series = await prisma.transactionSeries.findUnique({ where: { id: seriesId } });
  if (!series || series.userId !== userId) {
    return { error: "Série não encontrada." };
  }

  if (series.seriesType === "RECORRENTE") {
    const parsed = updateRecurrenceEndDateSchema.safeParse({
      seriesId,
      endDate: formString(formData, "endDate"),
    });
    if (!parsed.success) {
      return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const { endDate } = parsed.data;
    if (endDate && endDate < series.startDate) {
      return {
        error: "Verifique os campos informados.",
        fieldErrors: { endDate: ["A data final deve ser igual ou posterior à data de início da série."] },
      };
    }

    const today = new Date();
    let generatedUntil = series.generatedUntil;

    if (endDate) {
      // Shrinking (or setting an end date for the first time): drop
      // every not-yet-paid occurrence past the new cutoff.
      await prisma.transaction.deleteMany({
        where: { seriesId, status: "NAO_PAGO", date: { gt: endDate } },
      });
      // generatedUntil must never claim generation reached further than
      // what's actually left in the série — otherwise extending endDate
      // again later would skip regenerating the gap just deleted above.
      // Re-anchored to the latest REMAINING occurrence's own date (a
      // DB round trip, not arithmetic on `endDate` itself) so the
      // monthly cadence's day-of-month never drifts — endDate is a
      // cutoff the user chose, not necessarily a date any occurrence
      // actually falls on.
      if (generatedUntil && generatedUntil > endDate) {
        const latestRemaining = await prisma.transaction.findFirst({
          where: { seriesId },
          orderBy: { date: "desc" },
          select: { date: true },
        });
        generatedUntil = latestRemaining?.date ?? null;
      }
    }

    // Top up toward the new endDate (or, if cleared, back to the
    // standard rolling horizon) exactly like ensureRecurringOccurrences
    // does on every page load — this just does it immediately instead
    // of waiting for the next visit.
    const horizonDate = defaultHorizonDate(today);
    const cursorStart = generatedUntil ?? series.startDate;
    const fromDate = generatedUntil ? addMonthsClamped(cursorStart, 1) : cursorStart;
    const newRows =
      fromDate <= horizonDate ? buildRecurringRows({ ...series, endDate }, fromDate, horizonDate, today) : [];

    if (newRows.length > 0) {
      await prisma.transaction.createMany({ data: newRows, skipDuplicates: true });
      generatedUntil = newRows[newRows.length - 1].date;
    }

    await prisma.transactionSeries.update({
      where: { id: seriesId },
      data: { endDate, generatedUntil },
    });
  } else {
    const parsed = updateInstallmentCountSchema.safeParse({
      seriesId,
      installmentCount: formString(formData, "installmentCount"),
    });
    if (!parsed.success) {
      return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const { installmentCount: newCount } = parsed.data;
    const oldCount = series.installmentCount ?? 0;

    if (newCount < oldCount) {
      const lastPaidBeyondNewCount = await prisma.transaction.findFirst({
        where: { seriesId, status: "PAGO", installmentNumber: { gt: newCount } },
        orderBy: { installmentNumber: "desc" },
      });
      if (lastPaidBeyondNewCount) {
        return {
          error: "Verifique os campos informados.",
          fieldErrors: {
            installmentCount: [
              `Não é possível reduzir abaixo da parcela ${lastPaidBeyondNewCount.installmentNumber}, já paga.`,
            ],
          },
        };
      }
      await prisma.transaction.deleteMany({
        where: { seriesId, installmentNumber: { gt: newCount }, status: "NAO_PAGO" },
      });
    } else if (newCount > oldCount) {
      const newRows = buildInstallmentRows({ ...series, installmentCount: newCount }).filter(
        (row) => (row.installmentNumber ?? 0) > oldCount
      );
      if (newRows.length > 0) {
        await prisma.transaction.createMany({ data: newRows });
      }
    }

    await prisma.transactionSeries.update({
      where: { id: seriesId },
      data: { installmentCount: newCount },
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
