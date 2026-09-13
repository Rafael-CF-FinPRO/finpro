"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireModuleAccess } from "@/lib/modules";
import {
  patrimonioAssetSchema,
  patrimonioLiabilitySchema,
  patrimonioProtectionSchema,
  patrimonioSetActiveSchema,
  patrimonioConfirmMonthlyValueSchema,
} from "@/lib/validation";

export type PatrimonioActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

/** FormData entries come back as `null` when absent — every optional
 * field in the Gestão Patrimonial schemas (src/lib/validation.ts)
 * expects `undefined` instead, never `null`/`""`. */
function f(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value !== "" ? value : undefined;
}

async function requirePatrimonioSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  // Defense in depth — src/app/(app)/patrimonio/page.tsx already guards
  // the route itself, but a direct POST to this action must be denied
  // server-side too regardless of what the page would have shown.
  await requireModuleAccess("gestao_patrimonial");
  return session;
}

export async function saveAssetAction(
  _prevState: PatrimonioActionState,
  formData: FormData
): Promise<PatrimonioActionState> {
  const session = await requirePatrimonioSession();

  const parsed = patrimonioAssetSchema.safeParse({
    id: f(formData, "id"),
    category: f(formData, "category"),
    name: f(formData, "name"),
    currentValueCents: f(formData, "currentValueCents") ?? "",
    usageType: f(formData, "usageType"),
    location: f(formData, "location"),
    liquidity: f(formData, "liquidity"),
    updateMethod: f(formData, "updateMethod") ?? "MANUAL",
    annualRatePct: f(formData, "annualRatePct"),
    rateLabel: f(formData, "rateLabel"),
    purchaseDate: f(formData, "purchaseDate"),
    purchaseValueCents: f(formData, "purchaseValueCents"),
    isRented: f(formData, "isRented"),
    rentNetValueCents: f(formData, "rentNetValueCents"),
    notes: f(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;

  if (id) {
    const existing = await prisma.patrimonioAsset.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return { error: "Item não encontrado." };
    }
    await prisma.patrimonioAsset.update({ where: { id }, data });
  } else {
    await prisma.patrimonioAsset.create({ data: { ...data, userId: session.userId } });
  }

  revalidatePath("/patrimonio");
  return { success: true };
}

export async function setAssetActiveAction(formData: FormData) {
  const session = await requirePatrimonioSession();
  const parsed = patrimonioSetActiveSchema.safeParse({
    id: f(formData, "id"),
    isActive: f(formData, "isActive"),
  });
  if (!parsed.success) throw new Error("Item inválido.");

  await prisma.patrimonioAsset.updateMany({
    where: { id: parsed.data.id, userId: session.userId },
    data: { isActive: parsed.data.isActive },
  });
  revalidatePath("/patrimonio");
}

export async function saveLiabilityAction(
  _prevState: PatrimonioActionState,
  formData: FormData
): Promise<PatrimonioActionState> {
  const session = await requirePatrimonioSession();

  const parsed = patrimonioLiabilitySchema.safeParse({
    id: f(formData, "id"),
    category: f(formData, "category"),
    name: f(formData, "name"),
    currentBalanceCents: f(formData, "currentBalanceCents") ?? "",
    installmentValueCents: f(formData, "installmentValueCents"),
    remainingInstallments: f(formData, "remainingInstallments"),
    amortization: f(formData, "amortization"),
    cetPct: f(formData, "cetPct"),
    correctionIndex: f(formData, "correctionIndex"),
    administrationFeePct: f(formData, "administrationFeePct"),
    creditValueCents: f(formData, "creditValueCents"),
    liabilityType: f(formData, "liabilityType"),
    linkedAssetId: f(formData, "linkedAssetId"),
    startDate: f(formData, "startDate"),
    expectedEndDate: f(formData, "expectedEndDate"),
    dueDate: f(formData, "dueDate"),
    notes: f(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { id, linkedAssetId, ...rest } = parsed.data;

  if (linkedAssetId) {
    const asset = await prisma.patrimonioAsset.findUnique({ where: { id: linkedAssetId } });
    if (!asset || asset.userId !== session.userId) {
      return { error: "Bem vinculado inválido.", fieldErrors: { linkedAssetId: ["Bem vinculado inválido."] } };
    }
  }

  const data = { ...rest, linkedAssetId };

  if (id) {
    const existing = await prisma.patrimonioLiability.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return { error: "Item não encontrado." };
    }
    await prisma.patrimonioLiability.update({ where: { id }, data });
  } else {
    await prisma.patrimonioLiability.create({ data: { ...data, userId: session.userId } });
  }

  revalidatePath("/patrimonio");
  return { success: true };
}

export async function setLiabilityActiveAction(formData: FormData) {
  const session = await requirePatrimonioSession();
  const parsed = patrimonioSetActiveSchema.safeParse({
    id: f(formData, "id"),
    isActive: f(formData, "isActive"),
  });
  if (!parsed.success) throw new Error("Item inválido.");

  await prisma.patrimonioLiability.updateMany({
    where: { id: parsed.data.id, userId: session.userId },
    data: { isActive: parsed.data.isActive },
  });
  revalidatePath("/patrimonio");
}

export async function saveProtectionAction(
  _prevState: PatrimonioActionState,
  formData: FormData
): Promise<PatrimonioActionState> {
  const session = await requirePatrimonioSession();

  const parsed = patrimonioProtectionSchema.safeParse({
    id: f(formData, "id"),
    element: f(formData, "element"),
    objective: f(formData, "objective"),
    currentValueCents: f(formData, "currentValueCents"),
    idealValueCents: f(formData, "idealValueCents"),
    isNeeded: f(formData, "isNeeded"),
    isCovered: f(formData, "isCovered"),
    notes: f(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { id, ...data } = parsed.data;

  if (id) {
    const existing = await prisma.patrimonioProtection.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.userId) {
      return { error: "Item não encontrado." };
    }
    await prisma.patrimonioProtection.update({ where: { id }, data });
  } else {
    const maxOrder = await prisma.patrimonioProtection.aggregate({
      where: { userId: session.userId },
      _max: { order: true },
    });
    await prisma.patrimonioProtection.create({
      data: { ...data, userId: session.userId, order: (maxOrder._max.order ?? 0) + 1 },
    });
  }

  revalidatePath("/patrimonio");
  return { success: true };
}

export async function setProtectionActiveAction(formData: FormData) {
  const session = await requirePatrimonioSession();
  const parsed = patrimonioSetActiveSchema.safeParse({
    id: f(formData, "id"),
    isActive: f(formData, "isActive"),
  });
  if (!parsed.success) throw new Error("Item inválido.");

  await prisma.patrimonioProtection.updateMany({
    where: { id: parsed.data.id, userId: session.userId },
    data: { isActive: parsed.data.isActive },
  });
  revalidatePath("/patrimonio");
}

/** "Fotografia do mês" — confirms/adjusts one bem or dívida's value for
 * one specific month (src/lib/patrimonio.ts's sparse confirmation
 * ledger). Upsert: re-confirming the same item+month just updates the
 * value instead of erroring on the unique constraint. */
export async function confirmMonthlyValueAction(
  _prevState: PatrimonioActionState,
  formData: FormData
): Promise<PatrimonioActionState> {
  const session = await requirePatrimonioSession();

  const parsed = patrimonioConfirmMonthlyValueSchema.safeParse({
    kind: f(formData, "kind"),
    itemId: f(formData, "itemId"),
    monthKey: f(formData, "monthKey"),
    valueCents: f(formData, "valueCents") ?? "",
  });
  if (!parsed.success) {
    return { error: "Verifique os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { kind, itemId, monthKey, valueCents } = parsed.data;

  if (kind === "asset") {
    const asset = await prisma.patrimonioAsset.findUnique({ where: { id: itemId } });
    if (!asset || asset.userId !== session.userId) return { error: "Item não encontrado." };
    await prisma.patrimonioMonthlyConfirmation.upsert({
      where: { assetId_monthKey: { assetId: itemId, monthKey } },
      update: { valueCents },
      create: { userId: session.userId, assetId: itemId, monthKey, valueCents },
    });
  } else {
    const liability = await prisma.patrimonioLiability.findUnique({ where: { id: itemId } });
    if (!liability || liability.userId !== session.userId) return { error: "Item não encontrado." };
    await prisma.patrimonioMonthlyConfirmation.upsert({
      where: { liabilityId_monthKey: { liabilityId: itemId, monthKey } },
      update: { valueCents },
      create: { userId: session.userId, liabilityId: itemId, monthKey, valueCents },
    });
  }

  revalidatePath("/patrimonio");
  return { success: true };
}
