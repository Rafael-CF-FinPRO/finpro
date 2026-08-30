"use client";

import { useActionState } from "react";
import Link from "next/link";
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
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="field-label">
            Senha
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            Esqueci minha senha
          </Link>
        </div>
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
        Ainda não tem uma conta?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
        >
          Criar conta
        </Link>
      </p>
    </form>
  );
}
