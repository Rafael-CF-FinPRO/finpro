"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createTagSchema, deleteTagSchema, updateTagSchema } from "@/lib/validation";

export type TagActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  tag?: { id: string; name: string };
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
export async function createTagAction(input: { name: string }): Promise<TagActionState> {
  const userId = await requireUserId();

  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique o nome informado.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await prisma.tag.findFirst({
    where: { userId, name: parsed.data.name },
  });
  if (existing) {
    return {
      error: "Você já tem uma tag com esse nome.",
      fieldErrors: { name: ["Você já tem uma tag com esse nome."] },
    };
  }

  const tag = await prisma.tag.create({
    data: { userId, name: parsed.data.name },
  });

  revalidatePath("/lancamentos");
  revalidatePath("/configuracoes");
  return { success: true, tag: { id: tag.id, name: tag.name } };
}

// Configurações only — Lançamentos can only create, never rename.
export async function updateTagAction(input: {
  id: string;
  name: string;
}): Promise<TagActionState> {
  const userId = await requireUserId();

  const parsed = updateTagSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const tag = await prisma.tag.findUnique({ where: { id: parsed.data.id } });
  if (!tag || tag.userId !== userId) {
    return { error: "Tag não encontrada." };
  }

  const duplicate = await prisma.tag.findFirst({
    where: { userId, name: parsed.data.name, id: { not: tag.id } },
  });
  if (duplicate) {
    return {
      error: "Você já tem uma tag com esse nome.",
      fieldErrors: { name: ["Você já tem uma tag com esse nome."] },
    };
  }

  await prisma.tag.update({
    where: { id: tag.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/lancamentos");
  revalidatePath("/configuracoes");
  return { success: true };
}

// Configurações only. Real delete, not a soft-delete — safe because the
// Transaction.tagId FK is ON DELETE SET NULL: any historical transaction
// just loses the label, its amount/date/description/category are never
// touched.
export async function deleteTagAction(input: { id: string }): Promise<TagActionState> {
  const userId = await requireUserId();

  const parsed = deleteTagSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Tag inválida." };
  }

  const tag = await prisma.tag.findUnique({ where: { id: parsed.data.id } });
  if (!tag || tag.userId !== userId) {
    return { error: "Tag não encontrada." };
  }

  await prisma.tag.delete({ where: { id: tag.id } });

  revalidatePath("/lancamentos");
  revalidatePath("/configuracoes");
  return { success: true };
}
