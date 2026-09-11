"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FieldError";

const initialState: ActionState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

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

      <div>
        <label htmlFor="password" className="field-label">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field-input"
          placeholder="••••••••"
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <SubmitButton>Entrar</SubmitButton>

      <p className="text-center text-sm text-[var(--muted)]">
        Seu acesso é criado pelo administrador ou pelo seu consultor.
      </p>
    </form>
  );
}
