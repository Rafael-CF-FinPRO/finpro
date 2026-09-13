"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmMonthlyValueAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { formatCentsToBRL, centsToInputValue } from "@/lib/money";
import { MonthNavigator } from "@/components/orcamento/MonthNavigator";
import { SubmitButton } from "@/components/auth/SubmitButton";
import type { PatrimonioSnapshotRow } from "@/lib/patrimonio";

const initialState: PatrimonioActionState = {};

function ConfirmRow({ row, monthKey }: { row: PatrimonioSnapshotRow; monthKey: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(confirmMonthlyValueAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => {
      setEditing(false);
      router.refresh();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <tr className="border-t border-[var(--surface-border)]">
      <td className="px-3 py-2">
        <p className="font-medium text-[var(--text-primary)]">{row.name}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{row.categoryLabel}</p>
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <form action={formAction} className="flex items-center justify-end gap-2">
            <input type="hidden" name="kind" value={row.kind} />
            <input type="hidden" name="itemId" value={row.id} />
            <input type="hidden" name="monthKey" value={monthKey} />
            <input
              name="valueCents"
              type="text"
              inputMode="decimal"
              autoFocus
              required
              defaultValue={centsToInputValue(row.valueCents)}
              className="field-input w-32 text-right"
            />
            <SubmitButton>Salvar</SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <span className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(row.valueCents)}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.origin === "CONFIRMADO"
              ? "bg-[var(--success-bg)] text-[var(--success)]"
              : "bg-[var(--neutral-bg)] text-[var(--neutral)]"
          }`}
        >
          {row.origin === "CONFIRMADO" ? "Confirmado" : "Projetado"}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            {row.origin === "CONFIRMADO" ? "Ajustar" : "Confirmar"}
          </button>
        )}
      </td>
    </tr>
  );
}

/** "Fotografia do mês" — the central historical mechanic: for whichever
 * month is selected, shows every ativo/passivo's effective value
 * (src/lib/patrimonio.ts's effectiveValueFor, already resolved
 * server-side into `rows`) with a Projetado/Confirmado badge, and lets
 * the user confirm/adjust any one of them for that exact month. Reuses
 * the same MonthNavigator (?month= in the URL) as Orçamento — page.tsx
 * recomputes `rows` for whatever month is selected. */
export function MonthlyConfirmationPanel({ monthKey, rows }: { monthKey: string; rows: PatrimonioSnapshotRow[] }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Fotografia Patrimonial do Mês</p>
        <MonthNavigator monthKey={monthKey} />
      </div>
      <p className="mt-1 text-xs text-[var(--text-faint)]">
        Itens com projeção automática mostram o valor calculado até você confirmar manualmente o valor real do mês.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">Nenhum bem ou dívida ativa cadastrada ainda.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-[var(--muted)]">
                <th className="px-3 py-1.5">Item</th>
                <th className="px-3 py-1.5 text-right">Valor</th>
                <th className="px-3 py-1.5">Origem</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ConfirmRow key={`${row.kind}-${row.id}`} row={row} monthKey={monthKey} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
