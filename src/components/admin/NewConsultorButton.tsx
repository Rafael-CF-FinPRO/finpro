"use client";

import { useActionState, useEffect, useState } from "react";
import { createConsultorAction, type AdminActionState } from "@/app/actions/admin";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";

const initialState: AdminActionState = {};

export function NewConsultorButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createConsultorAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => setOpen(false), 300);
    return () => clearTimeout(timeout);
  }, [state.success]);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        + Novo Consultor
      </button>
      {open && (
        <Modal title="Novo Consultor" onClose={() => setOpen(false)}>
          <form action={formAction} className="space-y-4" noValidate>
            {state.error && <p className="alert-error">{state.error}</p>}

            <div>
              <label htmlFor="new-consultor-name" className="field-label">
                Nome
              </label>
              <input
                id="new-consultor-name"
                name="name"
                type="text"
                required
                className="field-input"
                placeholder="Nome completo do consultor"
              />
              <FieldError messages={state.fieldErrors?.name} />
            </div>

            <div>
              <label htmlFor="new-consultor-email" className="field-label">
                E-mail
              </label>
              <input
                id="new-consultor-email"
                name="email"
                type="email"
                required
                className="field-input"
                placeholder="consultor@exemplo.com"
              />
              <FieldError messages={state.fieldErrors?.email} />
            </div>

            <div>
              <label htmlFor="new-consultor-password" className="field-label">
                Senha provisória
              </label>
              <input
                id="new-consultor-password"
                name="password"
                type="text"
                required
                className="field-input"
                placeholder="Mínimo de 8 caracteres"
              />
              <FieldError messages={state.fieldErrors?.password} />
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Compartilhe esta senha com o consultor por fora do sistema.
              </p>
            </div>

            <SubmitButton>Cadastrar consultor</SubmitButton>
          </form>
        </Modal>
      )}
    </>
  );
}
