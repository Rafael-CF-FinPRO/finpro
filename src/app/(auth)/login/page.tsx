import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeForRole } from "@/lib/rbac";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Entrar | FinPRO",
};

export default async function LoginPage() {
  // DB-validated (unlike src/proxy.ts's cheap JWT-only check, which no
  // longer redirects away from here at all — see the comment there) —
  // a genuinely active session bounces straight to its role's home; a
  // session whose user was since deleted/deactivated correctly falls
  // through to the form below instead of looping forever.
  const session = await getSession();
  if (session) {
    redirect(homeForRole(session.role));
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Entre na sua conta
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Acompanhe sua vida financeira em um só lugar.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
