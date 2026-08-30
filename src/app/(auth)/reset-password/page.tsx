import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Redefinir senha | FinPRO",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <div>
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Link inválido
          </h1>
        </div>
        <p className="alert-error">
          Este link de redefinição de senha é inválido ou está incompleto.
        </p>
        <Link href="/forgot-password" className="btn-secondary mt-5 w-full">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Definir nova senha
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Escolha uma nova senha para sua conta.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
