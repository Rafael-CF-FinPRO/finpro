"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction, type ProfileActionState } from "@/app/actions/profile";
import { FieldError } from "@/components/auth/FieldError";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Salvando..." : "Salvar nova senha"}
    </button>
  );
}

const initialState: ProfileActionState = {};

/** Same reveal-on-click pattern as IncomeCard (src/components/orcamento/IncomeCard.tsx):
 * closed by default, "Alterar senha" reveals the form, a successful
 * save closes it again after a short delay so the success message is
 * still readable for a moment. */
export function ChangePasswordCard() {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => setEditing(false), 1200);
    return () => clearTimeout(timeout);
  }, [state.success]);

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Segurança</h2>

      {editing ? (
        <form action={formAction} className="mt-4 space-y-4" noValidate>
          {state.error && <p className="alert-error">{state.error}</p>}
          {state.success && <p className="alert-success">Senha atualizada com sucesso.</p>}

          <div>
            <label htmlFor="current-password" className="field-label">
              Senha atual
            </label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="field-input"
            />
            <FieldError messages={state.fieldErrors?.currentPassword} />
          </div>

          <div>
            <label htmlFor="new-password" className="field-label">
              Nova senha
            </label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              className="field-input"
              placeholder="Mínimo de 8 caracteres"
            />
            <FieldError messages={state.fieldErrors?.newPassword} />
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="field-label">
              Confirmar nova senha
            </label>
            <input
              id="confirm-new-password"
              name="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              required
              className="field-input"
            />
            <FieldError messages={state.fieldErrors?.confirmNewPassword} />
          </div>

          <div className="flex gap-3">
            <SaveButton />
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4">
          <p className="field-label">Senha</p>
          <p className="text-sm text-[var(--text-primary)]">••••••••</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            Alterar senha
          </button>
        </div>
      )}
    </div>
  );
}
