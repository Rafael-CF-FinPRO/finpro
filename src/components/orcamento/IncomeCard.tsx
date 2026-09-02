"use client";

import { useActionState, useEffect, useState } from "react";
import { updateIncomeAction, type BudgetActionState } from "@/app/actions/budget";
import { formatCentsToBRL } from "@/lib/money";

const initialState: BudgetActionState = {};

export function IncomeCard({ monthlyIncomeCents, hasProfile }: { monthlyIncomeCents: number; hasProfile: boolean }) {
  const [editing, setEditing] = useState(!hasProfile);
  const [showInfo, setShowInfo] = useState(false);
  const [state, formAction, pending] = useActionState(updateIncomeAction, initialState);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => setEditing(false), 300);
    return () => clearTimeout(timeout);
  }, [state.success]);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-1.5">
        <p className="text-sm text-[var(--muted)]">Renda mensal de referência</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowInfo((prev) => !prev)}
            aria-expanded={showInfo}
            aria-label="Como a renda mensal de referência é calculada"
            className="cursor-help text-xs text-[var(--muted)] hover:text-[var(--primary)]"
          >
            ⓘ
          </button>
          {showInfo && (
            <div className="absolute left-0 top-5 z-10 w-72 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-xs leading-relaxed text-stone-600 shadow-lg">
              <p>
                Some toda a renda anual esperada (salário, pró-labore, negócios, comissões,
                bônus, 13º, renda extra etc.) e divida por 12.
              </p>
              <p className="mt-1.5 font-medium text-stone-700">
                Exemplo: R$ 300.000,00 ÷ 12 = R$ 25.000,00/mês.
              </p>
              <p className="mt-1.5">
                Este valor não é calculado automaticamente com base nos seus lançamentos — você
                pode ajustá-lo manualmente sempre que quiser.
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="mt-0.5 text-xs text-[var(--muted)]">
        Renda anual total esperada ÷ 12. Ajustável manualmente a qualquer momento.
      </p>

      {editing ? (
        <form action={formAction} className="mt-2 flex flex-wrap items-start gap-3">
          <div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-[var(--muted)]">
                R$
              </span>
              <input
                name="monthlyIncomeCents"
                type="text"
                inputMode="decimal"
                autoFocus
                required
                defaultValue={
                  monthlyIncomeCents > 0
                    ? (monthlyIncomeCents / 100).toFixed(2).replace(".", ",")
                    : ""
                }
                placeholder="0,00"
                className="field-input w-48 pl-9"
              />
            </div>
            {state.fieldErrors?.monthlyIncomeCents && (
              <p className="mt-1.5 text-sm text-[var(--danger)]">
                {state.fieldErrors.monthlyIncomeCents[0]}
              </p>
            )}
            {state.error && !state.fieldErrors?.monthlyIncomeCents && (
              <p className="mt-1.5 text-sm text-[var(--danger)]">{state.error}</p>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </button>
          {hasProfile && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          )}
        </form>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-2xl font-semibold text-stone-900">
            {formatCentsToBRL(monthlyIncomeCents)}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
          >
            Editar
          </button>
        </div>
      )}
    </div>
  );
}
