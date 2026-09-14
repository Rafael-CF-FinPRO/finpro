import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/jwt";

const PROTECTED_PATHS = [
  "/dashboard",
  "/lancamentos",
  "/orcamento",
  "/configuracoes",
];

// There is deliberately no "already logged in -> bounce away from
// /login" branch here anymore. This middleware only ever verifies the
// JWT's signature/expiry (no DB access, by design — see
// verifySessionToken), so it can't tell a genuinely active session from
// one whose user was since deleted/deactivated. getSession()
// (src/lib/session.ts) DOES check the database, and every protected
// page already redirects to /login when it returns null — if this
// middleware also redirected an authenticated-looking-but-DB-invalid
// session away from /login, the two checks would disagree forever:
// /dashboard -> /login (page-level, DB says no) -> /dashboard
// (middleware-level, JWT says yes) -> ... The login page itself now
// does that redirect instead, using the same DB-validated getSession(),
// so a real session still bounces straight to its role's home and a
// stale one correctly falls through to the login form.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
