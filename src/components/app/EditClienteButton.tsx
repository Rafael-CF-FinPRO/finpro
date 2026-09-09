"use client";

import { useActionState, useEffect, useState } from "react";
import { updateClientProfileAction, type ConsultorActionState } from "@/app/actions/consultor";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initialState: ConsultorActionState = {};

/** "Editar" next to "Entrar"/"Acessar" on the Consultor's own Clientes
 * table (src/app/consultor/clientes/page.tsx) and the Admin's global
 * one (src/app/admin/clientes/page.tsx) — one component, since
 * updateClientProfileAction already enforces who may edit which cliente
 * server-side (requireOwnClient). Rendered once per table row, so ids
 * are namespaced by clienteId to avoid collisions. */
export function EditClienteButton({
  clienteId,
  initialName,
  initialEmail,
}: {
  clienteId: string;
  initialName: string;
  initialEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateClientProfileAction, initialState);

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
        <Modal title="Editar Cliente" onClose={() => setOpen(false)}>
          <form action={formAction} className="space-y-4" noValidate>
            <input type="hidden" name="id" value={clienteId} />
            {state.error && <p className="alert-error">{state.error}</p>}

            <div>
              <label htmlFor={`edit-cliente-name-${clienteId}`} className="field-label">
                Nome
              </label>
              <input
                id={`edit-cliente-name-${clienteId}`}
                name="name"
                type="text"
                required
                defaultValue={initialName}
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.name} />
            </div>

            <div>
              <label htmlFor={`edit-cliente-email-${clienteId}`} className="field-label">
                E-mail
              </label>
              <input
                id={`edit-cliente-email-${clienteId}`}
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
