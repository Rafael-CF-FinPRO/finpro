import { prisma } from "@/lib/prisma";
import { getBudgetOverview } from "@/lib/budget";
import { complianceTier, computeOverallCompliancePct, type ComplianceTier } from "@/lib/budget-calc";
import { currentMonthKey } from "@/lib/dates";
import type { UserStatus } from "@/generated/prisma/enums";

/** "Dias desde o último acesso" tiers — deliberately just 3 buckets
 * (plus "nunca acessou"), kept as named constants so the boundaries are
 * easy to retune without hunting through JSX (spec section 7: "os
 * limites exatos podem ser definidos de forma simples e facilmente
 * ajustável"). */
export const ACTIVE_DAYS_THRESHOLD = 7;
export const ATTENTION_DAYS_THRESHOLD = 30;

export type ActivityStatus = "ATIVO" | "ATENCAO" | "INATIVO" | "NUNCA_ACESSOU";

export function activityStatusFor(lastLoginAt: Date | null): {
  status: ActivityStatus;
  daysSinceLastAccess: number | null;
} {
  if (!lastLoginAt) return { status: "NUNCA_ACESSOU", daysSinceLastAccess: null };
  const days = Math.floor((Date.now() - lastLoginAt.getTime()) / (1000 * 60 * 60 * 24));
  const status: ActivityStatus =
    days <= ACTIVE_DAYS_THRESHOLD ? "ATIVO" : days <= ATTENTION_DAYS_THRESHOLD ? "ATENCAO" : "INATIVO";
  return { status, daysSinceLastAccess: days };
}

export type ConsultorClientRow = {
  id: string;
  name: string;
  email: string;
  daysSinceLastAccess: number | null;
  /** Usage recency (last login) — NOT the same thing as `accountStatus`
   * below (an admin-controlled account state). Two different concepts
   * that happen to share some label words. */
  activityStatus: ActivityStatus;
  /** ATIVO/INATIVO/BLOQUEADO — controls whether the cliente can log in
   * at all (see getSession, src/lib/session.ts). Set via
   * setClientStatusAction. */
  accountStatus: UserStatus;
  /** null when the cliente hasn't set up a BudgetProfile yet — nothing
   * to score, not the same as a genuinely CRITICO month. */
  complianceTier: ComplianceTier | null;
  compliancePct: number | null;
  /** Only meaningful when getClientRows() is called without a
   * consultorId filter (the Admin's own clientes list, which shows who
   * each cliente belongs to) — null for an unassigned cliente. Ignored
   * by the Consultor's own clientes page, whose rows are already
   * scoped to a single consultor. */
  consultorName: string | null;
};

/** One row per CLIENTE in a consultor's own portfolio (or, when
 * `consultorId` is omitted, every CLIENTE in the system — used by the
 * Admin's own clientes list). Reuses getBudgetOverview + computeOverallCompliancePct
 * exactly as the Dashboard's own monthly view does — no new compliance
 * calculation, just today's current-month score bucketed through the
 * same complianceTier() every other new consumer uses. Deliberately
 * getBudgetOverview(currentMonthKey()) rather than getBudgetHistory +
 * currentMonthRange(): the latter's [from, to) is built for exclusive
 * Date-range queries, but getBudgetHistory treats its bounds as
 * calendar days (both inclusive) — currentMonthRange().to lands exactly
 * on next month's 1st at midnight, which that inclusive-day math then
 * expands into a whole extra (empty, so falsely 100%-compliant) bucket
 * for next month, silently picked up by `.months.at(-1)`. */
export async function getClientRows(where: { consultorId?: string }): Promise<ConsultorClientRow[]> {
  const clientes = await prisma.user.findMany({
    where: { role: "CLIENTE", ...where },
    orderBy: { name: "asc" },
    include: { consultor: { select: { name: true } } },
  });

  const monthKey = currentMonthKey();

  return Promise.all(
    clientes.map(async (cliente) => {
      const { status: activityStatus, daysSinceLastAccess } = activityStatusFor(cliente.lastLoginAt);
      const overview = await getBudgetOverview(cliente.id, monthKey);
      const hasScore = overview.hasProfile;
      const pct = hasScore ? computeOverallCompliancePct(overview.classifications) : null;
      return {
        id: cliente.id,
        name: cliente.name,
        email: cliente.email,
        daysSinceLastAccess,
        activityStatus,
        accountStatus: cliente.status,
        complianceTier: pct !== null ? complianceTier(pct) : null,
        compliancePct: pct,
        consultorName: cliente.consultor?.name ?? null,
      };
    })
  );
}

export function formatDaysSinceLastAccess(days: number | null): string {
  if (days === null) return "Nunca acessou";
  if (days <= 0) return "Hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}
