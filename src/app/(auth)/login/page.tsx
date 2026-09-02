import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Entrar | FinPRO",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const resetSuccess = params.reset === "success";

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-stone-900">
          Entre na sua conta
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Acompanhe sua vida financeira em um só lugar.
        </p>
      </div>
      {resetSuccess && (
        <p className="alert-success mb-5">
          Senha redefinida com sucesso. Faça login com sua nova senha.
        </p>
      )}
      <LoginForm />
    </div>
  );
}
