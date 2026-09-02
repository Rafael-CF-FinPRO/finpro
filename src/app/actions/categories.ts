"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  createCategorySchema,
  setCategoryActiveSchema,
  updateCategorySchema,
} from "@/lib/validation";

export type CategoryActionState = {
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

export async function createCategoryAction(input: {
  name: string;
  type: string;
  classification: string;
}): Promise<CategoryActionState> {
  const userId = await requireUserId();

  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Entrada categories are always Receita — Classification is only
  // user-choosable for Saida categories, among the six budget areas.
  const classification = parsed.data.type === "ENTRADA" ? "RECEITA" : parsed.data.classification;
  if (parsed.data.type === "ENTRADA" && parsed.data.classification !== "RECEITA") {
    return { error: "Categorias de Entrada usam sempre a classificação Receita." };
  }

  const existing = await prisma.category.findFirst({
    where: {
      userId,
      name: parsed.data.name,
      type: parsed.data.type,
      classification,
    },
  });
  if (existing) {
    return {
      error: "Você já tem uma categoria com esse nome nessa classificação.",
      fieldErrors: { name: ["Você já tem uma categoria com esse nome nessa classificação."] },
    };
  }

  const maxOrder = await prisma.category.aggregate({
    where: { userId, type: parsed.data.type },
    _max: { order: true },
  });

  await prisma.category.create({
    data: {
      userId,
      name: parsed.data.name,
      type: parsed.data.type,
      classification,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  revalidatePath("/orcamento");
  revalidatePath("/lancamentos");
  return { success: true };
}

export async function updateCategoryAction(input: {
  id: string;
  name: string;
  classification: string;
}): Promise<CategoryActionState> {
  const userId = await requireUserId();

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.id } });
  if (!category || category.userId !== userId) {
    return { error: "Categoria não encontrada." };
  }

  if (category.type === "ENTRADA" && parsed.data.classification !== "RECEITA") {
    return { error: "Categorias de Entrada usam sempre a classificação Receita." };
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      userId,
      type: category.type,
      name: parsed.data.name,
      classification: parsed.data.classification,
      id: { not: category.id },
    },
  });
  if (duplicate) {
    return {
      error: "Você já tem uma categoria com esse nome nessa classificação.",
      fieldErrors: { name: ["Você já tem uma categoria com esse nome nessa classificação."] },
    };
  }

  const classificationChanged = category.classification !== parsed.data.classification;

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: category.id },
      data: { name: parsed.data.name, classification: parsed.data.classification },
    });

    if (classificationChanged) {
      // Keep each Transaction's classification snapshot in sync with its
      // category's current classification — otherwise Lançamentos and
      // Orçamento would silently disagree about which area a past
      // transaction belongs to. Amount/date/user/description are never
      // touched here.
      await tx.transaction.updateMany({
        where: { categoryId: category.id },
        data: { classification: parsed.data.classification },
      });
    }
  });

  revalidatePath("/orcamento");
  revalidatePath("/lancamentos");
  return { success: true };
}

// Real delete, only when nothing depends on the category — otherwise we'd
// either lose historical Transactions or leave them pointing at nothing.
// When there IS a dependency, the caller should inactivate instead.
export async function deleteCategoryAction(input: {
  id: string;
}): Promise<CategoryActionState> {
  const userId = await requireUserId();

  if (typeof input.id !== "string" || !input.id) {
    return { error: "Categoria inválida." };
  }

  const category = await prisma.category.findUnique({ where: { id: input.id } });
  if (!category || category.userId !== userId) {
    return { error: "Categoria não encontrada." };
  }

  const transactionCount = await prisma.transaction.count({
    where: { categoryId: category.id },
  });
  if (transactionCount > 0) {
    return {
      error:
        "Esta categoria tem lançamentos vinculados e não pode ser excluída. Inative-a para preservar o histórico.",
    };
  }

  await prisma.category.delete({ where: { id: category.id } });

  revalidatePath("/orcamento");
  revalidatePath("/lancamentos");
  return { success: true };
}

export async function setCategoryActiveAction(input: {
  id: string;
  isActive: boolean;
}): Promise<CategoryActionState> {
  const userId = await requireUserId();

  const parsed = setCategoryActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Categoria inválida." };
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.id } });
  if (!category || category.userId !== userId) {
    return { error: "Categoria não encontrada." };
  }

  await prisma.category.update({
    where: { id: category.id },
    data: { isActive: parsed.data.isActive },
  });

  revalidatePath("/orcamento");
  revalidatePath("/lancamentos");
  return { success: true };
}
