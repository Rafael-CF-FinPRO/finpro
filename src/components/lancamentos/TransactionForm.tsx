"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionActionState,
} from "@/app/actions/transactions";
import {
  createRecurringSeriesAction,
  createInstallmentSeriesAction,
  updateSeriesOccurrenceAction,
} from "@/app/actions/series";
import { createPaymentMethodAction } from "@/app/actions/payment-methods";
import { createTagAction } from "@/app/actions/tags";
import {
  CLASSIFICATION_LABELS,
  PERIODICITY_LABELS,
  TYPE_LABELS,
  type SeriesEditScope,
} from "@/lib/transaction-labels";
import { todayLocalDateInputValue } from "@/lib/dates";
import { formatCentsToBRL, parseMoneyToCents } from "@/lib/money";
import type { Classification, SeriesType } from "@/generated/prisma/enums";

// Fixed display order for classification groups — RECEITA first (the
// only classification ENTRADA categories use), then the SAIDA ones in
// the same order used throughout Orçamento, then NEUTRA (the only
// classification NEUTRO categories use).
const CLASSIFICATION_ORDER: Classification[] = [
  "RECEITA",
  "CUSTOS_OBRIGATORIOS",
  "PRAZERES_E_CONFORTOS",
  "INVESTIMENTOS",
  "NEUTRA",
];

type CategoryOption = {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
  classification: Classification;
  isActive: boolean;
};

export type SimpleOption = { id: string; name: string };

// A transaction that belongs to a series carries its seriesType so the
// form knows to show the "somente este / este e os próximos" choice
// and — for a PARCELADO series — to keep amount edits scoped to
// "somente este" only (see updateSeriesOccurrenceAction).
export type TransactionFormInitialData = {
  id: string;
  amountLabel: string;
  description: string;
  categoryId: string;
  paymentMethodId: string;
  tagId: string;
  dateValue: string;
  note: string;
  seriesId: string | null;
  seriesType: SeriesType | null;
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

type SeriesMode = "normal" | "recorrente" | "parcelado";

export function TransactionForm({
  type,
  categories,
  paymentMethods,
  tags,
  initialData,
  onSaved,
}: {
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  tags: SimpleOption[];
  initialData?: TransactionFormInitialData;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initialData);
  const belongsToSeries = Boolean(initialData?.seriesId);

  // Only relevant when creating — an existing transaction never
  // switches series membership through this form (normal stays
  // normal, a series occurrence stays in its series).
  const [seriesMode, setSeriesMode] = useState<SeriesMode>("normal");
  const [showSeriesOptions, setShowSeriesOptions] = useState(false);
  const [editScope, setEditScope] = useState<SeriesEditScope>("this");

  const action = isEdit
    ? belongsToSeries
      ? updateSeriesOccurrenceAction
      : updateTransactionAction
    : seriesMode === "recorrente"
      ? createRecurringSeriesAction
      : seriesMode === "parcelado"
        ? createInstallmentSeriesAction
        : createTransactionAction;

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
  const [amountText, setAmountText] = useState(initialData?.amountLabel ?? "");
  const [installmentCountText, setInstallmentCountText] = useState("2");

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

  const installmentCount = Math.max(2, Math.round(Number(installmentCountText)) || 2);
  const amountCentsPreview = parseMoneyToCents(amountText, { allowZero: true });
  const totalPreview =
    seriesMode === "parcelado" && amountCentsPreview !== null
      ? formatCentsToBRL(amountCentsPreview * installmentCount)
      : null;

  const dateLabel =
    seriesMode === "recorrente"
      ? "Data da primeira ocorrência"
      : seriesMode === "parcelado"
        ? "Data da primeira parcela"
        : "Data";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {isEdit && <input type="hidden" name="id" value={initialData!.id} />}
      <input type="hidden" name="type" value={type} />
      {belongsToSeries && <input type="hidden" name="scope" value={editScope} />}

      {state.error && <p className="alert-error">{state.error}</p>}

      {belongsToSeries && (
        <div>
          <p className="field-label">Esta alteração vale para</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={
                editScope === "this"
                  ? "btn-primary flex-1 !py-2 text-sm"
                  : "btn-secondary flex-1 !py-2 text-sm"
              }
              onClick={() => setEditScope("this")}
            >
              Somente este
            </button>
            <button
              type="button"
              className={
                editScope === "this_and_future"
                  ? "btn-primary flex-1 !py-2 text-sm"
                  : "btn-secondary flex-1 !py-2 text-sm"
              }
              onClick={() => setEditScope("this_and_future")}
            >
              Este e os próximos
            </button>
          </div>
          {editScope === "this_and_future" && initialData?.seriesType === "PARCELADO" && (
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              O valor da parcela é alterado somente nesta ocorrência — as demais mantêm o valor original.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="amountCents" className="field-label">
          Valor {seriesMode === "parcelado" && <span className="font-normal text-[var(--muted)]">(da parcela)</span>}
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
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
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
          placeholder={
            type === "ENTRADA"
              ? "Ex: Salário de agosto"
              : type === "NEUTRO"
                ? "Ex: Pagamento da fatura do cartão"
                : "Ex: Compras do mês"
          }
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
          {dateLabel}
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

      {!isEdit && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={showSeriesOptions}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowSeriesOptions(checked);
                if (!checked) setSeriesMode("normal");
              }}
            />
            É um lançamento recorrente ou parcelado?
          </label>

          {showSeriesOptions && (
            <div className="mt-3 space-y-3 rounded-lg border border-[var(--surface-border)] p-3">
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="seriesModeChoice"
                    checked={seriesMode === "recorrente"}
                    onChange={() => setSeriesMode("recorrente")}
                  />
                  Recorrente
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="seriesModeChoice"
                    checked={seriesMode === "parcelado"}
                    onChange={() => setSeriesMode("parcelado")}
                  />
                  Parcelado
                </label>
              </div>

              {seriesMode === "recorrente" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="periodicity" className="field-label">
                      Periodicidade
                    </label>
                    <select id="periodicity" name="periodicity" defaultValue="MENSAL" className="field-input">
                      {Object.entries(PERIODICITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="endDate" className="field-label">
                      Repetir até <span className="font-normal text-[var(--muted)]">(opcional)</span>
                    </label>
                    <input id="endDate" name="endDate" type="date" className="field-input" />
                    {state.fieldErrors?.endDate && (
                      <p className="mt-1.5 text-sm text-[var(--danger)]">
                        {state.fieldErrors.endDate[0]}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {seriesMode === "parcelado" && (
                <div>
                  <label htmlFor="installmentCount" className="field-label">
                    Quantidade de parcelas
                  </label>
                  <input
                    id="installmentCount"
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
                    <p className="mt-1.5 text-sm text-[var(--danger)]">
                      {state.fieldErrors.installmentCount[0]}
                    </p>
                  )}
                  {totalPreview && (
                    <p className="mt-1.5 text-sm text-[var(--muted)]">
                      Total da compra:{" "}
                      <span className="font-medium text-stone-700">{totalPreview}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
