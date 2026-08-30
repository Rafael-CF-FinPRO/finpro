import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Criar conta | FinPRO",
};

export default function RegisterPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Crie sua conta
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Comece a organizar suas finanças em minutos.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
