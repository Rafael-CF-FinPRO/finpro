import { redirect } from "next/navigation";
import { getSession, type EffectiveSession } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

/** Guards a page/layout/action to one or more roles — redirects to
 * `/login` with no session, or to that role's own home if logged in as
 * someone else (a CONSULTOR hitting /admin lands on /consultor, never a
 * blank/error page). Never used by the existing (app) group, which has
 * its own, more permissive guard (CLIENTE, or anyone actively
 * impersonating a CLIENTE) — see src/app/(app)/layout.tsx. */
export async function requireRole(...roles: Role[]): Promise<EffectiveSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect(homeForRole(session.role));
  return session;
}

export function homeForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "CONSULTOR") return "/consultor";
  return "/dashboard";
}

/** A CONSULTOR may only ever act on their own portfolio; an ADMIN acts
 * on anyone. Every consultor server action that touches a specific
 * cliente id calls this before doing anything else — the backend
 * boundary the spec calls for, never inferred from what the frontend
 * happened to show. */
export async function requireOwnClient(session: EffectiveSession, clienteId: string) {
  if (session.role === "ADMIN") return;
  const { prisma } = await import("@/lib/prisma");
  const cliente = await prisma.user.findUnique({
    where: { id: clienteId },
    select: { consultorId: true, role: true },
  });
  if (!cliente || cliente.role !== "CLIENTE" || cliente.consultorId !== session.realUserId) {
    throw new Error("Cliente não encontrado ou não pertence a este consultor.");
  }
}
