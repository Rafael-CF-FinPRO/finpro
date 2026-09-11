"use client";

import { useActionState, useEffect, useState } from "react";
import { resetConsultorPasswordAction, type AdminActionState } from "@/app/actions/admin";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initialState: AdminActionState = {};

/** "Redefinir senha" on the Admin's Consultores table — the ADMIN sets
 * a brand-new password directly (no current password to check, since
 * it isn't the account owner doing this). See resetConsultorPasswordAction
 * in src/app/actions/admin.ts. */
export function ResetConsultorPasswordButton({
  consultorId,
  consultorName,
}: {
  consultorId: string;
  consultorName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(resetConsultorPasswordAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => setOpen(false), 1200);
    return () => clearTimeout(timeout);
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
      >
        Redefinir senha
      </button>
      {open && (
        <Modal title={`Redefinir senha — ${consultorName}`} onClose={() => setOpen(false)}>
          <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="id" value={consultorId} />
            {state.error && <p className="alert-error">{state.error}</p>}
            {state.success && <p className="alert-success">Senha redefinida com sucesso.</p>}

            <div>
              <label htmlFor={`reset-consultor-password-${consultorId}`} className="field-label">
                Nova senha
              </label>
              <input
                id={`reset-consultor-password-${consultorId}`}
                name="newPassword"
                type="text"
                required
                className="field-input"
                placeholder="Mínimo de 8 caracteres"
              />
              <FieldError messages={state.fieldErrors?.newPassword} />
            </div>

            <div>
              <label htmlFor={`reset-consultor-confirm-${consultorId}`} className="field-label">
                Confirmar nova senha
              </label>
              <input
                id={`reset-consultor-confirm-${consultorId}`}
                name="confirmNewPassword"
                type="text"
                required
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.confirmNewPassword} />
            </div>

            <SubmitButton>Salvar nova senha</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}
