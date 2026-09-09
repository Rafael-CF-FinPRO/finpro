"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
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

  const session = await getSession();
  const previous = session?.isImpersonating
    ? await prisma.budgetProfile.findUnique({ where: { userId }, select: { monthlyIncomeCents: true } })
    : null;

  await prisma.budgetProfile.upsert({
    where: { userId },
    update: { monthlyIncomeCents: parsed.data.monthlyIncomeCents },
    create: { userId, monthlyIncomeCents: parsed.data.monthlyIncomeCents },
  });

  if (session) {
    await logAudit(session, {
      action: "budget.updateIncome",
      entityType: "BudgetProfile",
      entityId: userId,
      previousValue: previous ? { monthlyIncomeCents: previous.monthlyIncomeCents } : undefined,
      newValue: { monthlyIncomeCents: parsed.data.monthlyIncomeCents },
    });
  }

  revalidatePath("/orcamento");
  return { success: true };
}

/**
 * Saves the whole edit session (every category percentage touched
 * across all 3 classifications — classification percentages are never
 * submitted by the user, only derived) in one go, applying it either:
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
    return { error: "Configure todas as quatro classificações, sem duplicar ou omitir nenhuma." };
  }

  // Never trust the client for which classification a category belongs
  // to — look it up fresh, scoped to this user's own categories only.
  const userCategories = await prisma.category.findMany({
    where: { userId, type: "SAIDA" },
    select: { id: true, classification: true, isActive: true },
  });
  const categoryClassificationMap = new Map(userCategories.map((c) => [c.id, c.classification]));

  // Inactive categories don't need a budget share going forward — only
  // active ones must be present in the submission (see the completeness
  // check below).
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

  // A Classification's percentage is never taken from the client — it's
  // always the sum of its own (active) Categories' submitted
  // percentages, computed fresh here. The client-submitted
  // classifications[].percentage is only checked for shape above
  // (every classification present, once each); its actual value is
  // ignored from this point on. Categories are still required to be a
  // complete set per classification (none silently dropped), but
  // there's no longer a per-classification ceiling to enforce — the
  // only remaining limit is the whole-budget 100% cap, already
  // rejected by budgetDistributionSchema before this action body runs.
  const computedClassificationPct = new Map<Classification, number>();

  for (const classification of BUDGET_CLASSIFICATIONS) {
    const expectedIds = (categoriesByClassification.get(classification) ?? []).slice().sort();

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

    computedClassificationPct.set(
      classification,
      submitted.reduce((s, c) => s + c.percentage, 0)
    );
  }

  const targetMonthKey = applyScope === "month" ? monthKey : "default";

  await prisma.$transaction(async (tx) => {
    await tx.budgetClassificationAllocation.deleteMany({
      where: { budgetProfileId: profile.id, monthKey: targetMonthKey },
    });
    await tx.budgetClassificationAllocation.createMany({
      data: BUDGET_CLASSIFICATIONS.map((classification) => ({
        budgetProfileId: profile.id,
        classification,
        percentage: computedClassificationPct.get(classification) ?? 0,
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

  const session = await getSession();
  if (session) {
    await logAudit(session, {
      action: "budget.saveDistribution",
      entityType: "BudgetProfile",
      entityId: profile.id,
      newValue: {
        applyScope,
        monthKey: targetMonthKey,
        classifications: Object.fromEntries(computedClassificationPct),
        categoryCount: categories.length,
      },
    });
  }

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

  const session = await getSession();
  if (session) {
    await logAudit(session, {
      action: "budget.removeMonthOverride",
      entityType: "BudgetProfile",
      entityId: profile.id,
      previousValue: { monthKey: parsed.data.monthKey },
    });
  }

  revalidatePath("/orcamento");
  return { success: true };
}
