"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";
import { FieldError } from "./FieldError";

const initialState: ActionState = {};

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && <p className="alert-error">{state.error}</p>}

      <div>
        <label htmlFor="name" className="field-label">
          Nome
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="field-input"
          placeholder="Seu nome completo"
        />
        <FieldError messages={state.fieldErrors?.name} />
      </div>

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
          autoComplete="new-password"
          required
          className="field-input"
          placeholder="Mínimo de 8 caracteres"
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="field-label">
          Confirmar senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="field-input"
          placeholder="Repita a senha"
        />
        <FieldError messages={state.fieldErrors?.confirmPassword} />
      </div>

      <SubmitButton>Criar minha conta</SubmitButton>

      <p className="text-center text-sm text-[var(--muted)]">
        Já tem uma conta?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
