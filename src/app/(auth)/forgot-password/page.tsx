import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recuperar senha | FinPRO",
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-stone-900">
          Recuperar senha
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Informe seu e-mail para receber instruções de redefinição.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
