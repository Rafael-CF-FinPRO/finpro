"use client";

import { useActionState, useEffect } from "react";
import { saveAssetAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { Modal } from "@/components/orcamento/Modal";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { centsToInputValue } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { ASSET_CATEGORY_FIELD_CONFIG } from "@/lib/patrimonio-fields";
import { PATRIMONIO_ASSET_CATEGORY_LABELS } from "@/lib/patrimonio-colors";
import type { PatrimonioAsset } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory } from "@/generated/prisma/enums";

const initialState: PatrimonioActionState = {};

/** One shared modal for all 5 asset categories — which optional fields
 * render is driven entirely by ASSET_CATEGORY_FIELD_CONFIG, so adding a
 * 6th category later never means a 6th near-duplicate form component. */
export function AssetFormModal({
  category,
  asset,
  onClose,
}: {
  category: PatrimonioAssetCategory;
  asset?: PatrimonioAsset;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(saveAssetAction, initialState);
  const config = ASSET_CATEGORY_FIELD_CONFIG[category];
  const nameLabel = category === "FINANCEIRO" ? "Conta" : "Descrição";

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(onClose, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal
      title={asset ? `Editar — ${PATRIMONIO_ASSET_CATEGORY_LABELS[category]}` : `Novo — ${PATRIMONIO_ASSET_CATEGORY_LABELS[category]}`}
      onClose={onClose}
    >
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="category" value={category} />
        {asset && <input type="hidden" name="id" value={asset.id} />}
        {state.error && <p className="alert-error">{state.error}</p>}

        <div>
          <label className="field-label">{nameLabel}</label>
          <input name="name" type="text" required defaultValue={asset?.name} className="field-input" />
          <FieldError messages={state.fieldErrors?.name} />
        </div>

        <div>
          <label className="field-label">Valor atual</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-[var(--muted)]">
              R$
            </span>
            <input
              name="currentValueCents"
              type="text"
              inputMode="decimal"
              required
              defaultValue={centsToInputValue(asset?.currentValueCents)}
              placeholder="0,00"
              className="field-input pl-9"
            />
          </div>
          <FieldError messages={state.fieldErrors?.currentValueCents} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Tipo</label>
            <select name="usageType" defaultValue={asset?.usageType ?? ""} className="field-input">
              <option value="">Não informado</option>
              <option value="USO_PESSOAL">Uso Pessoal</option>
              <option value="GERADOR_RENDA">Gerador de Renda</option>
            </select>
          </div>
          <div>
            <label className="field-label">Localização</label>
            <select name="location" defaultValue={asset?.location ?? ""} className="field-input">
              <option value="">Não informado</option>
              <option value="ONSHORE">Onshore</option>
              <option value="OFFSHORE">Offshore</option>
            </select>
          </div>
        </div>

        {config.liquidity && (
          <div>
            <label className="field-label">Nível de liquidez</label>
            <select name="liquidity" defaultValue={asset?.liquidity ?? ""} className="field-input">
              <option value="">Não informado</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Média</option>
              <option value="BAIXA">Baixa</option>
            </select>
          </div>
        )}

        {config.rateLabel && (
          <div>
            <label className="field-label">Performance / Índice</label>
            <input
              name="rateLabel"
              type="text"
              defaultValue={asset?.rateLabel ?? ""}
              placeholder="Ex.: CDI, IPCA + 5% a.a."
              className="field-input"
            />
            <FieldError messages={state.fieldErrors?.rateLabel} />
          </div>
        )}

        {config.projection && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Data de compra</label>
                <input
                  name="purchaseDate"
                  type="date"
                  defaultValue={asset?.purchaseDate ? toDateInputValue(asset.purchaseDate) : ""}
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.purchaseDate} />
              </div>
              <div>
                <label className="field-label">Valor de compra</label>
                <input
                  name="purchaseValueCents"
                  type="text"
                  inputMode="decimal"
                  defaultValue={centsToInputValue(asset?.purchaseValueCents)}
                  placeholder="0,00"
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.purchaseValueCents} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Método de atualização</label>
                <select name="updateMethod" defaultValue={asset?.updateMethod ?? "MANUAL"} className="field-input">
                  <option value="MANUAL">Manual</option>
                  <option value="PROJECAO_AUTOMATICA">Projeção automática</option>
                </select>
              </div>
              <div>
                <label className="field-label">Taxa de correção anual (%)</label>
                <input
                  name="annualRatePct"
                  type="text"
                  inputMode="decimal"
                  defaultValue={asset?.annualRatePct != null ? String(asset.annualRatePct).replace(".", ",") : ""}
                  placeholder="Ex.: 8,5"
                  className="field-input"
                />
                <FieldError messages={state.fieldErrors?.annualRatePct} />
              </div>
            </div>
            <p className="text-xs text-[var(--text-faint)]">
              Com projeção automática, os meses sem confirmação manual usam esta taxa (composta ao mês) a partir
              do último valor conhecido.
            </p>
          </>
        )}

        {config.rent && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">É alugado?</label>
              <select name="isRented" defaultValue={asset?.isRented == null ? "" : String(asset.isRented)} className="field-input">
                <option value="">Não informado</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>
            <div>
              <label className="field-label">Valor do aluguel líquido</label>
              <input
                name="rentNetValueCents"
                type="text"
                inputMode="decimal"
                defaultValue={centsToInputValue(asset?.rentNetValueCents)}
                placeholder="0,00"
                className="field-input"
              />
              <FieldError messages={state.fieldErrors?.rentNetValueCents} />
            </div>
          </div>
        )}

        <div>
          <label className="field-label">Observações</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={asset?.notes ?? ""}
            className="field-input"
            placeholder="Documentos/anexos podem ser referenciados aqui por enquanto."
          />
          <FieldError messages={state.fieldErrors?.notes} />
        </div>

        <SubmitButton>{asset ? "Salvar alterações" : "Cadastrar"}</SubmitButton>
      </form>
    </Modal>
  );
}
