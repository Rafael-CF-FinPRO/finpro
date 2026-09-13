"use client";

import { useActionState, useEffect } from "react";
import { saveLiabilityAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { centsToInputValue } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { LIABILITY_CATEGORY_FIELD_CONFIG } from "@/lib/patrimonio-fields";
import { PATRIMONIO_LIABILITY_CATEGORY_LABELS } from "@/lib/patrimonio-colors";
import type { PatrimonioAsset, PatrimonioLiability } from "@/generated/prisma/client";
import type { PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

const initialState: PatrimonioActionState = {};

/** One shared modal for all 4 liability categories, mirroring
 * AssetFormModal — LIABILITY_CATEGORY_FIELD_CONFIG drives which
 * optional columns render. `assets` (the user's own active bens) feeds
 * the "Bem relacionado" dropdown for the categories that support
 * linking a dívida to the asset it financed. */
export function LiabilityFormModal({
  category,
  liability,
  assets,
  onClose,
}: {
  category: PatrimonioLiabilityCategory;
  liability?: PatrimonioLiability;
  assets: PatrimonioAsset[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(saveLiabilityAction, initialState);
  const config = LIABILITY_CATEGORY_FIELD_CONFIG[category];

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(onClose, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal
      title={
        liability
          ? `Editar — ${PATRIMONIO_LIABILITY_CATEGORY_LABELS[category]}`
          : `Novo — ${PATRIMONIO_LIABILITY_CATEGORY_LABELS[category]}`
      }
      onClose={onClose}
    >
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="category" value={category} />
        {liability && <input type="hidden" name="id" value={liability.id} />}
        {state.error && <p className="alert-error">{state.error}</p>}

        <div>
          <label className="field-label">Descrição</label>
          <input name="name" type="text" required defaultValue={liability?.name} className="field-input" />
          <FieldError messages={state.fieldErrors?.name} />
        </div>

        <div>
          <label className="field-label">{category === "CONSORCIO" ? "Saldo a pagar" : "Saldo devedor"}</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-[var(--muted)]">
              R$
            </span>
            <input
              name="currentBalanceCents"
              type="text"
              inputMode="decimal"
              required
              defaultValue={centsToInputValue(liability?.currentBalanceCents)}
              placeholder="0,00"
              className="field-input pl-9"
            />
          </div>
          <FieldError messages={state.fieldErrors?.currentBalanceCents} />
        </div>

        {config.liabilityType && (
          <div>
            <label className="field-label">Tipo</label>
            <input
              name="liabilityType"
              type="text"
              defaultValue={liability?.liabilityType ?? ""}
              placeholder="Ex.: Cartão de crédito, empréstimo pessoal informal..."
              className="field-input"
            />
            <FieldError messages={state.fieldErrors?.liabilityType} />
          </div>
        )}

        {config.installment && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Valor da parcela</label>
              <input
                name="installmentValueCents"
                type="text"
                inputMode="decimal"
                defaultValue={centsToInputValue(liability?.installmentValueCents)}
                placeholder="0,00"
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.installmentValueCents} />
            </div>
            <div>
              <label className="field-label">Parcelas restantes</label>
              <input
                name="remainingInstallments"
                type="text"
                inputMode="numeric"
                defaultValue={liability?.remainingInstallments ?? ""}
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.remainingInstallments} />
            </div>
          </div>
        )}

        {config.administrationFee && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Taxa de administração (%)</label>
              <input
                name="administrationFeePct"
                type="text"
                inputMode="decimal"
                defaultValue={
                  liability?.administrationFeePct != null ? String(liability.administrationFeePct).replace(".", ",") : ""
                }
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.administrationFeePct} />
            </div>
            <div>
              <label className="field-label">Crédito da carta</label>
              <input
                name="creditValueCents"
                type="text"
                inputMode="decimal"
                defaultValue={centsToInputValue(liability?.creditValueCents)}
                placeholder="0,00"
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.creditValueCents} />
            </div>
          </div>
        )}

        {config.amortization && (
          <div>
            <label className="field-label">Amortização</label>
            <input
              name="amortization"
              type="text"
              defaultValue={liability?.amortization ?? ""}
              placeholder="Ex.: SAC, PRICE..."
              className="field-input"
            />
            <FieldError messages={state.fieldErrors?.amortization} />
          </div>
        )}

        {(config.cet || config.correctionIndex) && (
          <div className="grid grid-cols-2 gap-3">
            {config.cet && (
              <div>
                <label className="field-label">CET (%)</label>
                <input
                  name="cetPct"
                  type="text"
                  inputMode="decimal"
                  defaultValue={liability?.cetPct != null ? String(liability.cetPct).replace(".", ",") : ""}
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.cetPct} />
              </div>
            )}
            {config.correctionIndex && (
              <div>
                <label className="field-label">{config.cet ? "Índice de correção" : "Taxa / índice"}</label>
                <input
                  name="correctionIndex"
                  type="text"
                  defaultValue={liability?.correctionIndex ?? ""}
                  placeholder="Ex.: IPCA, CDI..."
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.correctionIndex} />
              </div>
            )}
          </div>
        )}

        {config.linkedAsset && (
          <div>
            <label className="field-label">Bem relacionado</label>
            <select name="linkedAssetId" defaultValue={liability?.linkedAssetId ?? ""} className="field-input">
              <option value="">Nenhum</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
            <FieldError messages={state.fieldErrors?.linkedAssetId} />
          </div>
        )}

        {(config.startDate || config.expectedEndDate || config.dueDate) && (
          <div className="grid grid-cols-2 gap-3">
            {config.startDate && (
              <div>
                <label className="field-label">Data de início</label>
                <input
                  name="startDate"
                  type="date"
                  defaultValue={liability?.startDate ? toDateInputValue(liability.startDate) : ""}
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.startDate} />
              </div>
            )}
            {config.expectedEndDate && (
              <div>
                <label className="field-label">Previsão de término</label>
                <input
                  name="expectedEndDate"
                  type="date"
                  defaultValue={liability?.expectedEndDate ? toDateInputValue(liability.expectedEndDate) : ""}
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.expectedEndDate} />
              </div>
            )}
            {config.dueDate && (
              <div>
                <label className="field-label">Data de vencimento</label>
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={liability?.dueDate ? toDateInputValue(liability.dueDate) : ""}
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.dueDate} />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="field-label">Observações</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={liability?.notes ?? ""}
            className="field-input"
            placeholder="Documentos/anexos podem ser referenciados aqui por enquanto."
          />
          <FieldError messages={state.fieldErrors?.notes} />
        </div>

        <SubmitButton>{liability ? "Salvar alterações" : "Cadastrar"}</SubmitButton>
      </form>
    </Modal>
  );
}
