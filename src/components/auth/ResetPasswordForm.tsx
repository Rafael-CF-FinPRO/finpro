"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FieldError";

const initialState: ActionState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.error && <p className="alert-error">{state.error}</p>}

      <div>
        <label htmlFor="password" className="field-label">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="field-input"
          placeholder="Mínimo de 8 caracteres"
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="field-label">
          Confirmar nova senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="field-input"
          placeholder="Repita a nova senha"
        />
        <FieldError messages={state.fieldErrors?.confirmPassword} />
      </div>

      <SubmitButton>Redefinir senha</SubmitButton>

      <p className="text-center text-sm text-[var(--muted)]">
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
