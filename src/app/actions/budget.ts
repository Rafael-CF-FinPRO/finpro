"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  budgetDistributionSchema,
  incomeSchema,
  monthOverrideSchema,
} from "@/lib/validation";
import { BUDGET_CLASSIFICATIONS } from "@/lib/budget-calc";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import type { Classification } from "@/generated/prisma/enums";

export type BudgetActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};

async function requireUserId() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.userId;
}

export async function updateIncomeAction(
  _prevState: BudgetActionState,
  formData: FormData
): Promise<BudgetActionState> {
  const userId = await requireUserId();

  const raw = formData.get("monthlyIncomeCents");
  const parsed = incomeSchema.safeParse({
    monthlyIncomeCents: typeof raw === "string" ? raw : "",
  });

  if (!parsed.success) {
    return {
      error: "Verifique o valor informado.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await prisma.budgetProfile.upsert({
    where: { userId },
    update: { monthlyIncomeCents: parsed.data.monthlyIncomeCents },
    create: { userId, monthlyIncomeCents: parsed.data.monthlyIncomeCents },
  });

  revalidatePath("/orcamento");
  return { success: true };
}

/**
 * Saves the whole edit session (all six classification percentages, plus
 * every category percentage touched across them) in one go, applying it
 * either:
 *  - "month": only to the selected month (creates/updates that month's
 *    own override; the standing default is untouched).
 *  - "default": updates the standing default AND makes the selected
 *    month follow it (clearing any override *that month* had) — other
 *    months' explicit personalizations are left exactly as they were.
 */
export async function saveBudgetDistributionAction(input: {
  applyScope: "month" | "default";
  monthKey: string;
  classifications: { classification: string; percentage: number }[];
  categories: { categoryId: string; percentage: number }[];
}): Promise<BudgetActionState> {
  const userId = await requireUserId();

  const parsed = budgetDistributionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique a distribuição informada.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const profile = await prisma.budgetProfile.findUnique({ where: { userId } });
  if (!profile) {
    return { error: "Defina sua renda mensal de referência antes de configurar o orçamento." };
  }

  const { applyScope, monthKey, classifications, categories } = parsed.data;

  const submittedClassifications = classifications.map((c) => c.classification).sort();
  const expectedClassifications = [...BUDGET_CLASSIFICATIONS].sort();
  const classificationsMatch =
    submittedClassifications.length === expectedClassifications.length &&
    submittedClassifications.every((c, i) => c === expectedClassifications[i]);
  if (!classificationsMatch) {
    return { error: "Configure todas as seis classificações, sem duplicar ou omitir nenhuma." };
  }

  // Never trust the client for which classification a category belongs
  // to — look it up fresh, scoped to this user's own categories only.
  const userCategories = await prisma.category.findMany({
    where: { userId, type: "SAIDA" },
    select: { id: true, classification: true, isActive: true },
  });
  const categoryClassificationMap = new Map(userCategories.map((c) => [c.id, c.classification]));

  // Inactive categories don't need a budget share going forward — only
  // active ones are required to sum to 100% per classification.
  const categoriesByClassification = new Map<Classification, string[]>();
  for (const cat of userCategories) {
    if (!cat.isActive) continue;
    const list = categoriesByClassification.get(cat.classification) ?? [];
    list.push(cat.id);
    categoriesByClassification.set(cat.classification, list);
  }

  const submittedByClassification = new Map<
    Classification,
    { categoryId: string; percentage: number }[]
  >();
  for (const entry of categories) {
    const classification = categoryClassificationMap.get(entry.categoryId);
    if (!classification) {
      return { error: "Uma das categorias enviadas não existe ou não pertence à sua conta." };
    }
    const list = submittedByClassification.get(classification) ?? [];
    list.push(entry);
    submittedByClassification.set(classification, list);
  }

  for (const classification of BUDGET_CLASSIFICATIONS) {
    const expectedIds = (categoriesByClassification.get(classification) ?? []).slice().sort();
    if (expectedIds.length === 0) continue; // nothing to distribute (e.g. Metas with no categories yet)

    const submitted = submittedByClassification.get(classification) ?? [];
    const submittedIds = submitted.map((c) => c.categoryId).sort();
    const idsMatch =
      submittedIds.length === expectedIds.length &&
      submittedIds.every((id, i) => id === expectedIds[i]);
    if (!idsMatch) {
      return {
        error: `Configure todas as categorias de ${CLASSIFICATION_LABELS[classification]}, sem duplicar ou omitir nenhuma.`,
      };
    }
    const sum = submitted.reduce((s, c) => s + c.percentage, 0);
    if (sum !== 100) {
      return {
        error: `As categorias de ${CLASSIFICATION_LABELS[classification]} precisam totalizar 100%.`,
      };
    }
  }

  const targetMonthKey = applyScope === "month" ? monthKey : "default";

  await prisma.$transaction(async (tx) => {
    await tx.budgetClassificationAllocation.deleteMany({
      where: { budgetProfileId: profile.id, monthKey: targetMonthKey },
    });
    await tx.budgetClassificationAllocation.createMany({
      data: classifications.map((c) => ({
        budgetProfileId: profile.id,
        classification: c.classification as Classification,
        percentage: c.percentage,
        monthKey: targetMonthKey,
      })),
    });

    await tx.budgetCategoryAllocation.deleteMany({
      where: { budgetProfileId: profile.id, monthKey: targetMonthKey },
    });
    if (categories.length > 0) {
      await tx.budgetCategoryAllocation.createMany({
        data: categories.map((c) => ({
          budgetProfileId: profile.id,
          categoryId: c.categoryId,
          percentage: c.percentage,
          monthKey: targetMonthKey,
        })),
      });
    }

    if (applyScope === "default") {
      // The selected month now follows the freshly-updated default —
      // clear any override *that specific month* had. Other months'
      // explicit personalizations are untouched (different monthKey).
      await tx.budgetClassificationAllocation.deleteMany({
        where: { budgetProfileId: profile.id, monthKey },
      });
      await tx.budgetCategoryAllocation.deleteMany({
        where: { budgetProfileId: profile.id, monthKey },
      });
    }
  });

  revalidatePath("/orcamento");
  return { success: true };
}

export async function removeMonthOverrideAction(input: {
  monthKey: string;
}): Promise<BudgetActionState> {
  const userId = await requireUserId();

  const parsed = monthOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mês inválido." };
  }

  const profile = await prisma.budgetProfile.findUnique({ where: { userId } });
  if (!profile) {
    return { error: "Nenhum orçamento configurado ainda." };
  }

  await prisma.$transaction([
    prisma.budgetClassificationAllocation.deleteMany({
      where: { budgetProfileId: profile.id, monthKey: parsed.data.monthKey },
    }),
    prisma.budgetCategoryAllocation.deleteMany({
      where: { budgetProfileId: profile.id, monthKey: parsed.data.monthKey },
    }),
  ]);

  revalidatePath("/orcamento");
  return { success: true };
}
