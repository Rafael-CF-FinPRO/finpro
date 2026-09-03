"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionActionState,
} from "@/app/actions/transactions";
import { createPaymentMethodAction } from "@/app/actions/payment-methods";
import { createTagAction } from "@/app/actions/tags";
import { CLASSIFICATION_LABELS, TYPE_LABELS } from "@/lib/transaction-labels";
import { todayLocalDateInputValue } from "@/lib/dates";
import type { Classification } from "@/generated/prisma/enums";

// Fixed display order for classification groups — RECEITA first (the
// only classification ENTRADA categories use), then the SAIDA ones in
// the same order used throughout Orçamento.
const CLASSIFICATION_ORDER: Classification[] = [
  "RECEITA",
  "ESSENCIAIS",
  "NAO_ESSENCIAIS",
  "DIVIDAS",
  "INVESTIMENTOS",
];

type CategoryOption = {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA";
  classification: Classification;
  isActive: boolean;
};

export type SimpleOption = { id: string; name: string };

export type TransactionFormInitialData = {
  id: string;
  amountLabel: string;
  description: string;
  categoryId: string;
  paymentMethodId: string;
  tagId: string;
  dateValue: string;
  note: string;
};

const initialState: TransactionActionState = {};

// Shared by "Meio de Pagamento" and "Tag": a select for existing options
// plus an inline "add new" mini-flow. Lançamentos can only ever create new
// options this way — editing/deleting is Configurações-only, enforced by
// simply not offering that UI here.
function InlineCreatableSelect({
  label,
  name,
  options,
  value,
  onSelect,
  onCreate,
  placeholder,
  emptyLabel,
}: {
  label: string;
  name: string;
  options: SimpleOption[];
  value: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<SimpleOption | null>;
  placeholder: string;
  emptyLabel: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const created = await onCreate(newName);
      if (created) {
        onSelect(created.id);
        setNewName("");
        setAdding(false);
      } else {
        setError("Não foi possível adicionar. Verifique o nome informado.");
      }
    });
  }

  return (
    <div>
      <label className="field-label">
        {label} <span className="font-normal text-[var(--muted)]">(opcional)</span>
      </label>
      <input type="hidden" name={name} value={value} />
      {adding ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={placeholder}
            className="field-input flex-1"
            autoFocus
          />
          <button
            type="button"
            className="btn-primary"
            disabled={pending || !newName.trim()}
            onClick={handleCreate}
          >
            {pending ? "Adicionando..." : "Adicionar"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setAdding(false);
              setNewName("");
              setError(null);
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={value}
            onChange={(e) => onSelect(e.target.value)}
            className="field-input"
          >
            <option value="">{emptyLabel}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="whitespace-nowrap text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            onClick={() => setAdding(true)}
          >
            + Novo
          </button>
        </div>
      )}
      {error && <p className="mt-1.5 text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

export function TransactionForm({
  type,
  categories,
  paymentMethods,
  tags,
  initialData,
  onSaved,
}: {
  type: "ENTRADA" | "SAIDA";
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  tags: SimpleOption[];
  initialData?: TransactionFormInitialData;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initialData);
  const action = isEdit ? updateTransactionAction : createTransactionAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialData?.categoryId ?? ""
  );
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(
    initialData?.paymentMethodId ?? ""
  );
  const [selectedTagId, setSelectedTagId] = useState(initialData?.tagId ?? "");
  const [paymentMethodOptions, setPaymentMethodOptions] = useState(paymentMethods);
  const [tagOptions, setTagOptions] = useState(tags);

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

  // Grouped by classification (via <optgroup>) so the list matches how
  // categories are already organized in Orçamento — each group's
  // categories sorted alphabetically to make them faster to find. Names
  // are unique within a single type+classification pair, so no
  // disambiguation suffix is needed here.
  const groupedCategories = CLASSIFICATION_ORDER.map((classification) => ({
    classification,
    items: categoriesForType
      .filter((c) => c.classification === classification)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  })).filter((group) => group.items.length > 0);

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
        <p className="font-medium text-stone-700">
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
          Descrição <span className="font-normal text-[var(--muted)]">(opcional)</span>
        </label>
        <input
          id="description"
          name="description"
          type="text"
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
          {groupedCategories.map((group) => (
            <optgroup key={group.classification} label={CLASSIFICATION_LABELS[group.classification]}>
              {group.items.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
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
            <span className="font-medium text-stone-700">
              {CLASSIFICATION_LABELS[selectedCategory.classification]}
            </span>
          </p>
        )}
      </div>

      <InlineCreatableSelect
        label="Meio de pagamento"
        name="paymentMethodId"
        options={paymentMethodOptions}
        value={selectedPaymentMethodId}
        onSelect={setSelectedPaymentMethodId}
        placeholder="Ex: Cartão Nubank"
        emptyLabel="Nenhum"
        onCreate={async (name) => {
          const result = await createPaymentMethodAction({ name });
          if (!result.success || !result.paymentMethod) return null;
          setPaymentMethodOptions((prev) => [...prev, result.paymentMethod!]);
          return result.paymentMethod;
        }}
      />

      <InlineCreatableSelect
        label="Tag"
        name="tagId"
        options={tagOptions}
        value={selectedTagId}
        onSelect={setSelectedTagId}
        placeholder="Ex: Viagem para o Rio"
        emptyLabel="Nenhuma"
        onCreate={async (name) => {
          const result = await createTagAction({ name });
          if (!result.success || !result.tag) return null;
          setTagOptions((prev) => [...prev, result.tag!]);
          return result.tag;
        }}
      />

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
