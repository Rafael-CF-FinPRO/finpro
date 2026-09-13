import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getConsultorRows } from "@/lib/admin";
import type { ModuleStatus } from "@/generated/prisma/enums";

/** Every module key currently registered by src/lib/nav-items.tsx's
 * NAV_ITEMS (the four existing tabs) matches a SystemModule.key seeded
 * once via a one-off script — see the plan/migration note on
 * SystemModule in prisma/schema.prisma. */

/** The set of module keys the CURRENT effective session may see — or
 * the literal "ALL" for an ADMIN, who always has full access (spec:
 * "mesmo que bloqueado", for admin/dev/test purposes). Cached per
 * request (same pattern as getSession itself) so the menu filter and a
 * page's own guard never re-run the underlying queries twice. */
export const getAccessibleModuleKeys = cache(async (): Promise<"ALL" | Set<string>> => {
  const session = await getSession();
  if (!session) return new Set();
  if (session.role === "ADMIN") return "ALL";

  // Which consultor "governs" the environment currently being
  // rendered: the CONSULTOR themself (acting in their own environment,
  // not impersonating anyone), or the consultor a CLIENTE belongs to —
  // the same field (session.userId) covers both a direct CLIENTE login
  // and a CONSULTOR/ADMIN impersonating that CLIENTE.
  const effectiveUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, consultorId: true },
  });
  const consultorRefId =
    effectiveUser?.role === "CONSULTOR" ? session.userId : (effectiveUser?.consultorId ?? null);

  const [modules, grants] = await Promise.all([
    prisma.systemModule.findMany(),
    consultorRefId
      ? prisma.consultantModuleAccess.findMany({
          where: { consultorId: consultorRefId, isEnabled: true },
          select: { moduleId: true },
        })
      : Promise.resolve([]),
  ]);
  const grantedModuleIds = new Set(grants.map((g) => g.moduleId));

  const keys = new Set<string>();
  for (const m of modules) {
    if (m.status === "ATIVA") {
      keys.add(m.key);
    } else if (m.status === "EM_DESENVOLVIMENTO" && grantedModuleIds.has(m.id)) {
      keys.add(m.key);
    }
    // BLOQUEADA never adds the key, even if a ConsultantModuleAccess
    // row for it exists and is enabled — that row is preserved, just
    // ignored while the module's global status is BLOQUEADA.
  }
  return keys;
});

export async function hasModuleAccess(moduleKey: string): Promise<boolean> {
  const keys = await getAccessibleModuleKeys();
  return keys === "ALL" || keys.has(moduleKey);
}

/** Route guard for a module's own page — mirrors requireRole's
 * redirect-on-denial convention (src/lib/rbac.ts). Every existing
 * module page calls this right after its own `if (!session)
 * redirect("/login")`; since all four existing modules are seeded
 * ATIVA, this is a no-op today and only starts actually redirecting
 * once an ADMIN changes a module's status. */
export async function requireModuleAccess(moduleKey: string) {
  if (!(await hasModuleAccess(moduleKey))) {
    redirect("/dashboard");
  }
}

// ---- Admin Master's "Gestão de Funcionalidades" screen ----------------

export type ModuleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ModuleStatus;
  /** null for ATIVA/BLOQUEADA, where "liberados"/"impactados" aren't a
   * specific count (everyone, or no one) — only meaningful for
   * EM_DESENVOLVIMENTO. */
  consultoresLiberados: number | null;
  clientesImpactados: number | null;
};

export async function getModuleRows(): Promise<ModuleRow[]> {
  const [modules, consultores] = await Promise.all([
    prisma.systemModule.findMany({ orderBy: { createdAt: "asc" } }),
    getConsultorRows(),
  ]);

  const grants =
    modules.length > 0
      ? await prisma.consultantModuleAccess.findMany({
          where: { moduleId: { in: modules.map((m) => m.id) }, isEnabled: true },
        })
      : [];
  const clientCountByConsultorId = new Map(consultores.map((c) => [c.id, c.clientCount]));

  return modules.map((m) => {
    if (m.status !== "EM_DESENVOLVIMENTO") {
      return {
        id: m.id,
        key: m.key,
        name: m.name,
        description: m.description,
        status: m.status,
        consultoresLiberados: null,
        clientesImpactados: null,
      };
    }
    const enabledConsultorIds = grants.filter((g) => g.moduleId === m.id).map((g) => g.consultorId);
    const clientesImpactados = enabledConsultorIds.reduce(
      (sum, id) => sum + (clientCountByConsultorId.get(id) ?? 0),
      0
    );
    return {
      id: m.id,
      key: m.key,
      name: m.name,
      description: m.description,
      status: m.status,
      consultoresLiberados: enabledConsultorIds.length,
      clientesImpactados,
    };
  });
}

export type ModuleConsultorAccessRow = {
  consultorId: string;
  name: string;
  email: string;
  clientCount: number;
  isEnabled: boolean;
};

export async function getModuleByKey(moduleKey: string) {
  return prisma.systemModule.findUnique({ where: { key: moduleKey } });
}

export async function getModuleConsultorAccessRows(moduleId: string): Promise<ModuleConsultorAccessRow[]> {
  const [consultores, grants] = await Promise.all([
    getConsultorRows(),
    prisma.consultantModuleAccess.findMany({ where: { moduleId } }),
  ]);
  const grantByConsultorId = new Map(grants.map((g) => [g.consultorId, g.isEnabled]));

  return consultores.map((c) => ({
    consultorId: c.id,
    name: c.name,
    email: c.email,
    clientCount: c.clientCount,
    isEnabled: grantByConsultorId.get(c.id) ?? false,
  }));
}
