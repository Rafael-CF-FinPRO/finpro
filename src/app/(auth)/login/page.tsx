import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Entrar | FinPRO",
};

export default function LoginPage() {
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
