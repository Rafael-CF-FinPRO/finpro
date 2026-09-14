"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSeriesSettingsAction, type SeriesSettingsActionState } from "@/app/actions/series";
import { formatCentsToBRL } from "@/lib/money";
import type { SeriesType } from "@/generated/prisma/enums";

const initialState: SeriesSettingsActionState = {};

/** "Ajustar recorrência/parcelamento" for a lançamento that ALREADY
 * belongs to a série — a separate, sibling <form> from TransactionForm
 * (never nested inside it), since this is always a whole-série change
 * with no "somente este" equivalent (there's no such thing as "até
 * quando repete" or "quantas parcelas" for a single occurrence). Unlike
 * TransactionForm, a successful save doesn't close the modal — the user
 * may still want to edit the occurrence's own fields below via the main
 * form. */
export function SeriesSettingsForm({
  seriesId,
  seriesType,
  initialEndDate,
  initialInstallmentCount,
  amountCents,
}: {
  seriesId: string;
  seriesType: SeriesType;
  initialEndDate: string | null;
  initialInstallmentCount: number | null;
  amountCents: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateSeriesSettingsAction, initialState);
  const [installmentCountText, setInstallmentCountText] = useState(
    String(initialInstallmentCount ?? 2)
  );

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
  }, [state.success, router]);

  const installmentCount = Math.max(2, Math.round(Number(installmentCountText)) || 2);
  const totalPreview =
    seriesType === "PARCELADO" ? formatCentsToBRL(amountCents * installmentCount) : null;

  return (
    <form
      action={formAction}
      className="mb-4 space-y-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3"
    >
      <input type="hidden" name="seriesId" value={seriesId} />
      <p className="text-sm font-medium text-[var(--text-secondary)]">
        {seriesType === "RECORRENTE" ? "Ajustar recorrência" : "Ajustar parcelamento"}
      </p>

      {state.error && <p className="alert-error text-xs">{state.error}</p>}

      {seriesType === "RECORRENTE" ? (
        <div>
          <label htmlFor="seriesEndDate" className="field-label">
            Repetir até <span className="font-normal text-[var(--muted)]">(opcional)</span>
          </label>
          <input
            id="seriesEndDate"
            name="endDate"
            type="date"
            defaultValue={initialEndDate ?? ""}
            className="field-input"
          />
          {state.fieldErrors?.endDate && (
            <p className="mt-1.5 text-sm text-[var(--danger)]">{state.fieldErrors.endDate[0]}</p>
          )}
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Deixe em branco para voltar a repetir sem data de término. Ocorrências ainda não pagas fora do novo
            período são removidas; as já pagas nunca são alteradas.
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="seriesInstallmentCount" className="field-label">
            Quantidade de parcelas
          </label>
          <input
            id="seriesInstallmentCount"
            name="installmentCount"
            type="number"
            min={2}
            max={360}
            required
            value={installmentCountText}
            onChange={(e) => setInstallmentCountText(e.target.value)}
            className="field-input"
          />
          {state.fieldErrors?.installmentCount && (
            <p className="mt-1.5 text-sm text-[var(--danger)]">{state.fieldErrors.installmentCount[0]}</p>
          )}
          {totalPreview && (
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Novo total da compra: <span className="font-medium text-[var(--text-secondary)]">{totalPreview}</span>
            </p>
          )}
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Reduzir remove parcelas futuras ainda não pagas; aumentar gera novas parcelas seguintes. Não é
            possível reduzir abaixo de uma parcela já paga.
          </p>
        </div>
      )}

      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </button>
      {state.success && <span className="ml-2 text-xs font-medium text-[var(--success)]">Salvo.</span>}
    </form>
  );
}
