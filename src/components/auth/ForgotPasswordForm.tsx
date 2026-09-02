"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FieldError";

const initialState: ActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    initialState
  );

  if (state.success) {
    return (
      <div className="space-y-5">
        <p className="alert-success">{state.message}</p>

        {state.devResetLink && (
          <div className="rounded-lg border border-dashed border-[var(--surface-border)] bg-stone-50 p-3.5 text-sm text-stone-600">
            <p className="font-medium text-stone-700">Modo de desenvolvimento</p>
            <p className="mt-1">
              Nenhum serviço de e-mail está configurado ainda. Use o link
              abaixo para continuar o teste:
            </p>
            <Link
              href={state.devResetLink}
              className="mt-2 inline-block break-all font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              {state.devResetLink}
            </Link>
          </div>
        )}

        <Link href="/login" className="btn-secondary w-full">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <p className="alert-error">{state.error}</p>}

      <div>
        <label htmlFor="email" className="field-label">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field-input"
          placeholder="voce@exemplo.com"
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>

      <SubmitButton>Enviar instruções</SubmitButton>

      <p className="text-center text-sm text-[var(--muted)]">
        Lembrou a senha?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
        >
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
