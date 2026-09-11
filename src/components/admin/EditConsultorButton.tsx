"use client";

import { useActionState, useEffect, useState } from "react";
import { updateConsultorProfileAction, type AdminActionState } from "@/app/actions/admin";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initialState: AdminActionState = {};

/** "Editar" on the Admin's Consultores table — mirrors
 * src/components/app/EditClienteButton.tsx exactly, just for a
 * Consultor's own cadastro instead of a Cliente's. */
export function EditConsultorButton({
  consultorId,
  initialName,
  initialEmail,
}: {
  consultorId: string;
  initialName: string;
  initialEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateConsultorProfileAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => setOpen(false), 300);
    return () => clearTimeout(timeout);
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
      >
        Editar
      </button>
      {open && (
        <Modal title="Editar Consultor" onClose={() => setOpen(false)}>
          <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="id" value={consultorId} />
            {state.error && <p className="alert-error">{state.error}</p>}

            <div>
              <label htmlFor={`edit-consultor-name-${consultorId}`} className="field-label">
                Nome
              </label>
              <input
                id={`edit-consultor-name-${consultorId}`}
                name="name"
                type="text"
                required
                defaultValue={initialName}
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.name} />
            </div>

            <div>
              <label htmlFor={`edit-consultor-email-${consultorId}`} className="field-label">
                E-mail
              </label>
              <input
                id={`edit-consultor-email-${consultorId}`}
                name="email"
                type="email"
                required
                defaultValue={initialEmail}
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.email} />
            </div>

            <SubmitButton>Salvar alterações</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}
