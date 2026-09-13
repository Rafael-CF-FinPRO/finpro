"use client";

import { useActionState, useEffect } from "react";
import { saveProtectionAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { centsToInputValue } from "@/lib/money";
import type { PatrimonioProtection } from "@/generated/prisma/client";

const initialState: PatrimonioActionState = {};

function booleanDefault(value: boolean | null | undefined): string {
  return value == null ? "" : String(value);
}

/** Protection is a single flat table (no category discriminator, unlike
 * Ativos/Passivos) — the 17 seeded elements are just regular rows the
 * user edits in place; this modal also handles adding a custom element
 * beyond the suggested list (`element` is free text, not an enum). */
export function ProtectionFormModal({
  protection,
  onClose,
}: {
  protection?: PatrimonioProtection;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(saveProtectionAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(onClose, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal title={protection ? "Editar Proteção" : "Nova Proteção"} onClose={onClose}>
      <form action={formAction} className="space-y-4" noValidate>
        {protection && <input type="hidden" name="id" value={protection.id} />}
        {state.error && <p className="alert-error">{state.error}</p>}

        <div>
          <label className="field-label">Elemento</label>
          <input name="element" type="text" required defaultValue={protection?.element} className="field-input" />
          <FieldError messages={state.fieldErrors?.element} />
        </div>

        <div>
          <label className="field-label">Objetivo / finalidade</label>
          <textarea name="objective" rows={2} defaultValue={protection?.objective ?? ""} className="field-input" />
          <FieldError messages={state.fieldErrors?.objective} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Valor da proteção atual</label>
            <input
              name="currentValueCents"
              type="text"
              inputMode="decimal"
              defaultValue={centsToInputValue(protection?.currentValueCents)}
              placeholder="0,00"
              className="field-input"
            />
            <FieldError messages={state.fieldErrors?.currentValueCents} />
          </div>
          <div>
            <label className="field-label">Valor ideal</label>
            <input
              name="idealValueCents"
              type="text"
              inputMode="decimal"
              defaultValue={centsToInputValue(protection?.idealValueCents)}
              placeholder="0,00"
              className="field-input"
            />
            <FieldError messages={state.fieldErrors?.idealValueCents} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Necessidade</label>
            <select name="isNeeded" defaultValue={booleanDefault(protection?.isNeeded)} className="field-input">
              <option value="">Não informado</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>
          <div>
            <label className="field-label">Coberto?</label>
            <select name="isCovered" defaultValue={booleanDefault(protection?.isCovered)} className="field-input">
              <option value="">Não informado</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Observações</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={protection?.notes ?? ""}
            className="field-input"
            placeholder="Documentos/anexos podem ser referenciados aqui por enquanto."
          />
          <FieldError messages={state.fieldErrors?.notes} />
        </div>

        <SubmitButton>{protection ? "Salvar alterações" : "Cadastrar"}</SubmitButton>
      </form>
    </Modal>
  );
}
