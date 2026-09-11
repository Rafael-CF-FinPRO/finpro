"use client";

import { useActionState, useEffect, useState } from "react";
import { resetClientPasswordAction, type ConsultorActionState } from "@/app/actions/consultor";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initialState: ConsultorActionState = {};

/** "Redefinir senha" on the Consultor's own Clientes table and the
 * Admin's global one — same component, since resetClientPasswordAction
 * already enforces who may reset whose password server-side
 * (requireOwnClient). See src/components/app/EditClienteButton.tsx for
 * the identical id-namespacing rationale. */
export function ResetClientPasswordButton({
  clienteId,
  clienteName,
}: {
  clienteId: string;
  clienteName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(resetClientPasswordAction, initialState);

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
        <Modal title={`Redefinir senha — ${clienteName}`} onClose={() => setOpen(false)}>
          <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="id" value={clienteId} />
            {state.error && <p className="alert-error">{state.error}</p>}
            {state.success && <p className="alert-success">Senha redefinida com sucesso.</p>}

            <div>
              <label htmlFor={`reset-cliente-password-${clienteId}`} className="field-label">
                Nova senha
              </label>
              <input
                id={`reset-cliente-password-${clienteId}`}
                name="newPassword"
                type="text"
                required
                className="field-input"
                placeholder="Mínimo de 8 caracteres"
              />
              <FieldError messages={state.fieldErrors?.newPassword} />
            </div>

            <div>
              <label htmlFor={`reset-cliente-confirm-${clienteId}`} className="field-label">
                Confirmar nova senha
              </label>
              <input
                id={`reset-cliente-confirm-${clienteId}`}
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
