"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionActionState,
} from "@/app/actions/transactions";
import { CLASSIFICATION_LABELS, TYPE_LABELS } from "@/lib/transaction-labels";
import { todayLocalDateInputValue } from "@/lib/dates";
import type { Classification } from "@/generated/prisma/enums";

type CategoryOption = {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA";
  classification: Classification;
  isActive: boolean;
};

export type TransactionFormInitialData = {
  id: string;
  amountLabel: string;
  description: string;
  categoryId: string;
  dateValue: string;
  note: string;
};

const initialState: TransactionActionState = {};

export function TransactionForm({
  type,
  categories,
  initialData,
  onSaved,
}: {
  type: "ENTRADA" | "SAIDA";
  categories: CategoryOption[];
  initialData?: TransactionFormInitialData;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initialData);
  const action = isEdit ? updateTransactionAction : createTransactionAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialData?.categoryId ?? ""
  );

  // Inactive categories aren't offered for new selections, but an
  // existing transaction that already points at one must keep showing
  // it — otherwise editing that transaction would silently lose or
  // change its category.
  const categoriesForType = categories.filter(
    (c) => c.type === type && (c.isActive || c.id === initialData?.categoryId)
  );
  const selectedCategory = categoriesForType.find(
    (c) => c.id === selectedCategoryId
  );

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(onSaved, 900);
    return () => clearTimeout(timeout);
  }, [state.success, onSaved]);

  if (state.success) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="font-medium text-slate-700">
          {TYPE_LABELS[type]} registrada com sucesso.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {isEdit && <input type="hidden" name="id" value={initialData!.id} />}
      <input type="hidden" name="type" value={type} />

      {state.error && <p className="alert-error">{state.error}</p>}

      <div>
        <label htmlFor="amountCents" className="field-label">
          Valor
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-[var(--muted)]">
            R$
          </span>
          <input
            id="amountCents"
            name="amountCents"
            type="text"
            inputMode="decimal"
            autoFocus
            required
            defaultValue={initialData?.amountLabel}
            placeholder="0,00"
            className="field-input pl-9"
          />
        </div>
        {state.fieldErrors?.amountCents && (
          <p className="mt-1.5 text-sm text-[var(--danger)]">
            {state.fieldErrors.amountCents[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="field-label">
          Descrição
        </label>
        <input
          id="description"
          name="description"
          type="text"
          required
          defaultValue={initialData?.description}
          placeholder={type === "ENTRADA" ? "Ex: Salário de agosto" : "Ex: Compras do mês"}
          className="field-input"
        />
        {state.fieldErrors?.description && (
          <p className="mt-1.5 text-sm text-[var(--danger)]">
            {state.fieldErrors.description[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="categoryId" className="field-label">
          Categoria
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="field-input"
        >
          <option value="" disabled>
            Selecione uma categoria
          </option>
          {categoriesForType.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.categoryId && (
          <p className="mt-1.5 text-sm text-[var(--danger)]">
            {state.fieldErrors.categoryId[0]}
          </p>
        )}
        {selectedCategory && (
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Classificação:{" "}
            <span className="font-medium text-slate-700">
              {CLASSIFICATION_LABELS[selectedCategory.classification]}
            </span>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="date" className="field-label">
          Data
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={initialData?.dateValue ?? todayLocalDateInputValue()}
          className="field-input"
        />
        {state.fieldErrors?.date && (
          <p className="mt-1.5 text-sm text-[var(--danger)]">
            {state.fieldErrors.date[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="note" className="field-label">
          Observação <span className="font-normal text-[var(--muted)]">(opcional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={initialData?.note}
          className="field-input resize-none"
        />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
