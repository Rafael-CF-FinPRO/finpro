import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import type { Classification } from "@/generated/prisma/enums";

/**
 * The same category concept (e.g. "Pets") can exist more than once for a
 * user, once per Classification it was split into (see
 * src/lib/default-categories.ts and AGENTS.md stage 3 spec, section 6/7).
 * Whenever a flat list mixes categories from different classifications —
 * the Lançamentos category picker, its filter — a bare name is
 * ambiguous. This appends " — Classificação" only to the names that
 * actually collide within the given list, leaving unique names alone.
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
        ? `${c.name} — ${CLASSIFICATION_LABELS[c.classification]}`
        : c.name,
  }));
}
