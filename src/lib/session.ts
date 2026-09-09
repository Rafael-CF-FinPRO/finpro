import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_DURATION_SECONDS,
  signSessionToken,
  verifySessionToken,
  signImpersonationToken,
  verifyImpersonationToken,
} from "@/lib/jwt";
import type { Role } from "@/generated/prisma/enums";

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const token = await signSessionToken(userId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);
}

/** A CONSULTOR (or ADMIN) starts "atuando como" a CLIENTE — a separate,
 * short-lived cookie from the login session itself (see jwt.ts), so it
 * can be cleared independently by "Voltar para Clientes" without
 * logging the consultor out. Ownership (the cliente actually belongs to
 * this consultor) is the caller's responsibility to check *before*
 * calling this — see requireOwnClient in src/lib/rbac.ts — since
 * getSession() below re-validates it on every read anyway, but the
 * cookie itself is set here unconditionally.
 */
export async function startImpersonation(consultorId: string, clienteId: string) {
  const expiresAt = new Date(Date.now() + IMPERSONATION_DURATION_SECONDS * 1000);
  const token = await signImpersonationToken({ consultorId, clienteId }, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function stopImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);
}

export type EffectiveSession = {
  /** Whose DATA every existing page/action should read and write — the
   * cliente being impersonated, or the logged-in user's own id
   * otherwise. Every call site written before this multiuser layer
   * existed already does `const session = await getSession(); ...
   * session.userId ...`, so keeping this the primary field (rather than
   * introducing a differently-named one) is what lets a CONSULTOR use
   * every one of the CLIENTE's existing features with zero changes to
   * those files. */
  userId: string;
  /** The role of the person actually logged in (never the impersonated
   * cliente's role, which is always CLIENTE anyway). */
  role: Role;
  /** The actually logged-in user's own id — always equal to `userId`
   * unless isImpersonating is true. */
  realUserId: string;
  isImpersonating: boolean;
  /** Only set while isImpersonating — avoids a second lookup in the
   * UI (the impersonation banner, audit log labels) for the cliente's
   * display name. */
  impersonatedClientName?: string;
};

/** The one place every page/action in the app asks "who am I, and whose
 * data am I working with" — see EffectiveSession.userId above for why
 * those are sometimes different things. `cache()` (React's per-request
 * memoization, not a cross-request cache) means calling this from
 * multiple pages/components during the same request only hits the
 * database once. A deactivated CONSULTOR/ADMIN (isActive: false) is
 * treated as having no session at all — logged out on their very next
 * request, no separate "disabled account" screen needed. */
export const getSession = cache(async (): Promise<EffectiveSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  const base: EffectiveSession = {
    userId: user.id,
    role: user.role,
    realUserId: user.id,
    isImpersonating: false,
  };

  if (user.role === "CLIENTE") return base;

  const impersonationToken = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (!impersonationToken) return base;

  const impersonation = await verifyImpersonationToken(impersonationToken);
  if (!impersonation || impersonation.consultorId !== user.id) return base;

  // Re-checked against the database on every read, never trusted from
  // the cookie's own claim alone — an ADMIN can impersonate anyone, a
  // CONSULTOR only a cliente still assigned to them (ownership could
  // have changed since the cookie was issued).
  const cliente = await prisma.user.findUnique({
    where: { id: impersonation.clienteId },
    select: { id: true, name: true, role: true, isActive: true, consultorId: true },
  });
  const ownsClient =
    user.role === "ADMIN" || cliente?.consultorId === user.id;
  if (!cliente || !cliente.isActive || cliente.role !== "CLIENTE" || !ownsClient) {
    return base;
  }

  return {
    userId: cliente.id,
    role: user.role,
    realUserId: user.id,
    isImpersonating: true,
    impersonatedClientName: cliente.name,
  };
});
