"use client";

import { useActionState, useEffect, useState } from "react";
import { createClientAction, type ConsultorActionState } from "@/app/actions/consultor";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initialState: ConsultorActionState = {};

/** The Consultor sets the cliente's initial password directly here —
 * there's no self-service registration or password recovery in this
 * version (only a superior can set/reset a password, see
 * resetClientPasswordAction). On success the table behind this modal
 * re-renders via createClientAction's own revalidatePath, so closing
 * the modal is all this component does. */
export function NewClienteButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createClientAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => setOpen(false), 300);
    return () => clearTimeout(timeout);
  }, [state.success]);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Novo Cliente
      </button>
      {open && (
        <Modal title="Novo Cliente" onClose={() => setOpen(false)}>
          <form action={formAction} className="space-y-4" noValidate>
            {state.error && <p className="alert-error">{state.error}</p>}

            <div>
              <label htmlFor="new-cliente-name" className="field-label">
                Nome
              </label>
              <input
                id="new-cliente-name"
                name="name"
                type="text"
                required
                className="field-input"
                placeholder="Nome completo do cliente"
              />
              <FieldError messages={state.fieldErrors?.name} />
            </div>

            <div>
              <label htmlFor="new-cliente-email" className="field-label">
                E-mail
              </label>
              <input
                id="new-cliente-email"
                name="email"
                type="email"
                required
                className="field-input"
                placeholder="cliente@exemplo.com"
              />
              <FieldError messages={state.fieldErrors?.email} />
            </div>

            <div>
              <label htmlFor="new-cliente-phone" className="field-label">
                Contato telefônico
              </label>
              <input
                id="new-cliente-phone"
                name="phone"
                type="tel"
                className="field-input"
                placeholder="(11) 91234-5678"
              />
              <FieldError messages={state.fieldErrors?.phone} />
            </div>

            <div>
              <label htmlFor="new-cliente-password" className="field-label">
                Senha inicial
              </label>
              <input
                id="new-cliente-password"
                name="password"
                type="text"
                required
                className="field-input"
                placeholder="Mínimo de 8 caracteres"
              />
              <FieldError messages={state.fieldErrors?.password} />
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Compartilhe esta senha com o cliente por fora do sistema.
              </p>
            </div>

            <SubmitButton>Cadastrar cliente</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}
