import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "finpro_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

// A separate cookie from the login session — who is *really* logged in
// (SESSION_COOKIE_NAME) never changes while impersonating; this one is
// only "is there an active impersonation, and of which cliente" and is
// cleared independently by "Voltar para Clientes" without touching the
// login itself. Same signing key/algorithm as the login token — no
// reason to manage a second secret for a token with the same trust
// requirements.
export const IMPERSONATION_COOKIE_NAME = "finpro_impersonation";
// Deliberately short-lived — impersonation is meant to be a single
// working session, not a standing state; the consultor re-enters from
// Clientes if they need it again later. Independent of the 30-day
// login session's own expiry.
export const IMPERSONATION_DURATION_SECONDS = 60 * 60 * 4; // 4 hours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
};

export async function signSessionToken(userId: string, expiresAt: Date) {
  return new SignJWT({ userId } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export type ImpersonationPayload = {
  consultorId: string;
  clienteId: string;
};

export async function signImpersonationToken(
  payload: ImpersonationPayload,
  expiresAt: Date
) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey());
}

export async function verifyImpersonationToken(
  token: string
): Promise<ImpersonationPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.consultorId !== "string" || typeof payload.clienteId !== "string") {
      return null;
    }
    return { consultorId: payload.consultorId, clienteId: payload.clienteId };
  } catch {
    return null;
  }
}
