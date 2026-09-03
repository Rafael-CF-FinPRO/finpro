import { CLASSIFICATION_DISAMBIGUATION_LABELS } from "@/lib/transaction-labels";
import type { Classification } from "@/generated/prisma/enums";

/**
 * The same category concept (e.g. "Pets") can exist more than once for a
 * user, once per Classification (see src/lib/default-categories.ts) —
 * the name itself is never decorated to tell them apart, only the
 * Classification does. Whenever a flat list mixes categories from
 * different classifications — the Lançamentos category filter — a bare
 * name is ambiguous. This appends " — Custo Obrigatório" / "— Prazer e
 * Conforto" etc. only to the names that actually collide within the
 * given list, leaving unique names alone.
 */
export function withCategoryDisplayName<T extends { name: string; classification: Classification }>(
  categories: T[]
): (T & { displayName: string })[] {
  const counts = new Map<string, number>();
  for (const c of categories) {
    counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  }

  return categories.map((c) => ({
    ...c,
    displayName:
      (counts.get(c.name) ?? 0) > 1
        ? `${c.name} — ${CLASSIFICATION_DISAMBIGUATION_LABELS[c.classification]}`
        : c.name,
  }));
}
