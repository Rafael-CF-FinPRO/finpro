import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Shared server-only helpers behind both a normal transaction and a
// recurring/installment series (src/app/actions/transactions.ts and
// src/app/actions/series.ts) — plain functions, not Server Actions
// themselves, so this file deliberately has no "use server" directive
// (a "use server" file may only export async functions, and exposing
// these as public server-action endpoints would be the wrong shape
// anyway — they're internal building blocks, not user-invokable).

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function formType(formData: FormData): "ENTRADA" | "SAIDA" | "NEUTRO" {
  const value = formData.get("type");
  if (value === "SAIDA") return "SAIDA";
  if (value === "NEUTRO") return "NEUTRO";
  return "ENTRADA";
}

export async function requireUserId() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.userId;
}

export async function resolveCategory(
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
export type OptionalRefResult = { ok: true; id: string | null } | { ok: false };

export async function resolvePaymentMethodId(id: string, userId: string): Promise<OptionalRefResult> {
  if (!id) return { ok: true, id: null };
  const paymentMethod = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!paymentMethod || paymentMethod.userId !== userId) return { ok: false };
  return { ok: true, id: paymentMethod.id };
}

export async function resolveTagId(id: string, userId: string): Promise<OptionalRefResult> {
  if (!id) return { ok: true, id: null };
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag || tag.userId !== userId) return { ok: false };
  return { ok: true, id: tag.id };
}
