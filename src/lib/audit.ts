import { prisma } from "@/lib/prisma";
import type { EffectiveSession } from "@/lib/session";

/** Records one write a CONSULTOR/ADMIN made while impersonating a
 * CLIENTE — a no-op (no query at all) for the CLIENTE's own direct
 * usage, since `session.isImpersonating` is always false then. Called
 * as the last step of a write action, right before the `revalidatePath`
 * it already has — never replaces or wraps the actual mutation, which
 * every existing action keeps doing exactly as before. `previousValue`/
 * `newValue` are whatever plain-object snapshot the caller already has
 * on hand (never re-fetched here) — this is a log for a human to read,
 * not a queryable audit trail. */
export async function logAudit(
  session: EffectiveSession,
  entry: {
    action: string;
    entityType: string;
    entityId?: string;
    previousValue?: unknown;
    newValue?: unknown;
  }
) {
  if (!session.isImpersonating) return;
  await prisma.auditLog.create({
    data: {
      consultorId: session.realUserId,
      clienteId: session.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previousValue: entry.previousValue === undefined ? undefined : (entry.previousValue as object),
      newValue: entry.newValue === undefined ? undefined : (entry.newValue as object),
    },
  });
}
