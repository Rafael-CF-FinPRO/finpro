"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { importTransactionsAction, type ImportCommitRow } from "@/app/actions/import";
import { createPaymentMethodAction } from "@/app/actions/payment-methods";
import { createTagAction } from "@/app/actions/tags";
import { formatCentsToBRL, parseMoneyToCents } from "@/lib/money";
import { parseDateInputValue } from "@/lib/dates";
import { CLASSIFICATION_LABELS, CONFIDENCE_LABELS, type SuggestionConfidence } from "@/lib/transaction-labels";
import { CreatableSelectField, type SimpleOption } from "./CreatableSelectField";
import type { ParsedTransactionRow } from "@/lib/import/types";
import type { Classification } from "@/generated/prisma/enums";

type CategoryOption = {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
  classification: Classification;
  isActive: boolean;
};

const CLASSIFICATION_ORDER: Classification[] = [
  "RECEITA",
  "CUSTOS_OBRIGATORIOS",
  "PRAZERES_E_CONFORTOS",
  "INVESTIMENTOS",
  "NEUTRA",
];

type EditableRow = {
  rowId: string;
  include: boolean;
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
  dateValue: string;
  amountText: string;
  description: string;
  categoryId: string;
  categoryConfidence: SuggestionConfidence | null;
  categoryReason: string | null;
  paymentMethodId: string;
  tagId: string;
  parseWarnings: string[];
  possibleDuplicateOfId: string | null;
};

function formatAmountInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function toEditableRow(row: ParsedTransactionRow): EditableRow {
  return {
    rowId: row.rowId,
    include: row.possibleDuplicateOfId === null,
    type: row.type,
    dateValue: row.date,
    amountText: formatAmountInput(row.amountCents),
    description: row.description,
    categoryId: row.suggestedCategoryId ?? "",
    categoryConfidence: row.suggestedCategoryConfidence,
    categoryReason: row.suggestedCategoryReason,
    paymentMethodId: row.suggestedPaymentMethodId ?? "",
    tagId: row.suggestedTagId ?? "",
    parseWarnings: row.parseWarnings,
    possibleDuplicateOfId: row.possibleDuplicateOfId,
  };
}

function ConfidenceBadge({ confidence }: { confidence: SuggestionConfidence }) {
  const badgeClass =
    confidence === "HIGH"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : confidence === "MEDIUM"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : "bg-[var(--danger-bg)] text-[var(--danger)]";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

function rowError(row: EditableRow): string | null {
  if (!parseDateInputValue(row.dateValue)) return "Data inválida.";
  if (parseMoneyToCents(row.amountText) === null) return "Valor inválido.";
  if (!row.categoryId) return "Selecione uma categoria.";
  return null;
}

export function ImportReviewTable({
  initialRows,
  categories,
  paymentMethods,
  tags,
  onCancel,
  onImported,
}: {
  initialRows: ParsedTransactionRow[];
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  tags: SimpleOption[];
  onCancel: () => void;
  onImported: (count: number) => void;
}) {
  const [rows, setRows] = useState<EditableRow[]>(() => initialRows.map(toEditableRow));
  const [paymentMethodOptions, setPaymentMethodOptions] = useState(paymentMethods);
  const [tagOptions, setTagOptions] = useState(tags);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function updateRow(rowId: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function categoriesForType(type: "ENTRADA" | "SAIDA" | "NEUTRO") {
    return CLASSIFICATION_ORDER.map((classification) => ({
      classification,
      items: categories
        .filter((c) => c.type === type && c.classification === classification && c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    })).filter((group) => group.items.length > 0);
  }

  const includedRows = rows.filter((r) => r.include);
  const invalidIncludedCount = includedRows.filter((r) => rowError(r) !== null).length;
  const totalCents = includedRows.reduce((sum, r) => sum + (parseMoneyToCents(r.amountText) ?? 0), 0);

  function handleSubmit() {
    setFormError(null);
    setRowErrors({});

    if (includedRows.length === 0) {
      setFormError("Selecione ao menos um lançamento para importar.");
      return;
    }
    if (invalidIncludedCount > 0) {
      setFormError("Corrija os lançamentos selecionados com erro antes de importar.");
      return;
    }

    const commitRows: ImportCommitRow[] = includedRows.map((r) => ({
      rowId: r.rowId,
      type: r.type,
      amountCents: r.amountText,
      description: r.description,
      categoryId: r.categoryId,
      paymentMethodId: r.paymentMethodId,
      tagId: r.tagId,
      date: r.dateValue,
      note: "",
    }));

    startTransition(async () => {
      const result = await importTransactionsAction({ rows: commitRows });
      if (result.error) {
        setFormError(result.error);
        if (result.rowErrors) setRowErrors(result.rowErrors);
        return;
      }
      onImported(result.importedCount ?? includedRows.length);
    });
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-stone-900">Revisar lançamentos</p>
          <p className="text-sm text-[var(--muted)]">
            Confira e ajuste cada linha antes de confirmar a importação.
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-stone-900">
            {includedRows.length} de {rows.length} selecionados
          </p>
          <p className="text-[var(--muted)]">Total: {formatCentsToBRL(totalCents)}</p>
        </div>
      </div>

      {formError && <p className="alert-error mb-4">{formError}</p>}

      <div className="overflow-x-auto rounded-lg border border-[var(--surface-border)]">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--surface-border)] bg-stone-50 text-left text-xs font-medium text-[var(--muted)]">
              <th className="px-2 py-2">Incluir</th>
              <th className="px-2 py-2">Data</th>
              <th className="px-2 py-2">Tipo</th>
              <th className="px-2 py-2">Valor</th>
              <th className="px-2 py-2">Descrição</th>
              <th className="px-2 py-2">Categoria</th>
              <th className="px-2 py-2">Confiança</th>
              <th className="px-2 py-2">Meio de pagamento</th>
              <th className="px-2 py-2">Tag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const error = rowError(row);
              const commitError = rowErrors[row.rowId];
              return (
                <tr
                  key={row.rowId}
                  className={`border-b border-[var(--surface-border)] align-top last:border-b-0 ${
                    row.include ? "" : "opacity-50"
                  }`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => updateRow(row.rowId, { include: e.target.checked })}
                      className="h-4 w-4"
                      aria-label="Incluir este lançamento"
                    />
                    {row.possibleDuplicateOfId && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--warning)]">
                        <AlertTriangle size={12} className="shrink-0" /> Duplicata?
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={row.dateValue}
                      onChange={(e) => updateRow(row.rowId, { dateValue: e.target.value })}
                      className="field-input w-full py-1 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={row.type}
                      onChange={(e) => {
                        const value = e.target.value;
                        const type = value === "SAIDA" ? "SAIDA" : value === "NEUTRO" ? "NEUTRO" : "ENTRADA";
                        const stillValid = categories.some(
                          (c) => c.id === row.categoryId && c.type === type
                        );
                        updateRow(row.rowId, {
                          type,
                          categoryId: stillValid ? row.categoryId : "",
                          ...(stillValid ? {} : { categoryConfidence: null, categoryReason: null }),
                        });
                      }}
                      className="field-input w-full py-1 text-xs"
                    >
                      <option value="ENTRADA">Entrada</option>
                      <option value="SAIDA">Saída</option>
                      <option value="NEUTRO">Neutro</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-[var(--muted)]">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.amountText}
                        onChange={(e) => updateRow(row.rowId, { amountText: e.target.value })}
                        className="field-input w-full py-1 pl-7 text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <textarea
                      value={row.description}
                      onChange={(e) => updateRow(row.rowId, { description: e.target.value })}
                      rows={2}
                      className="field-input w-full resize-none py-1 text-xs break-words"
                    />
                    {row.parseWarnings.map((warning) => (
                      <p key={warning} className="mt-1 flex items-start gap-1 text-xs text-[var(--warning)]">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {warning}
                      </p>
                    ))}
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={row.categoryId}
                      onChange={(e) =>
                        updateRow(row.rowId, {
                          categoryId: e.target.value,
                          categoryConfidence: null,
                          categoryReason: null,
                        })
                      }
                      className="field-input w-full py-1 text-xs"
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {categoriesForType(row.type).map((group) => (
                        <optgroup key={group.classification} label={CLASSIFICATION_LABELS[group.classification]}>
                          {group.items.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {row.categoryConfidence && <ConfidenceBadge confidence={row.categoryConfidence} />}
                    {!row.categoryId && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--danger)]">
                        <AlertTriangle size={12} className="shrink-0" /> Revisar
                      </p>
                    )}
                    {row.categoryConfidence && row.categoryReason && (
                      <p className="mt-1 text-xs break-words text-[var(--muted)]">{row.categoryReason}</p>
                    )}
                    {!row.categoryConfidence && row.categoryId && (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <CreatableSelectField
                      options={paymentMethodOptions}
                      value={row.paymentMethodId}
                      onSelect={(id) => updateRow(row.rowId, { paymentMethodId: id })}
                      placeholder="Ex: Cartão Nubank"
                      emptyLabel="Nenhum"
                      ariaLabel="Meio de pagamento"
                      onCreate={async (name) => {
                        const result = await createPaymentMethodAction({ name });
                        if (!result.success || !result.paymentMethod) return null;
                        setPaymentMethodOptions((prev) => [...prev, result.paymentMethod!]);
                        return result.paymentMethod;
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <CreatableSelectField
                      options={tagOptions}
                      value={row.tagId}
                      onSelect={(id) => updateRow(row.rowId, { tagId: id })}
                      placeholder="Ex: Viagem"
                      emptyLabel="Nenhuma"
                      ariaLabel="Tag"
                      onCreate={async (name) => {
                        const result = await createTagAction({ name });
                        if (!result.success || !result.tag) return null;
                        setTagOptions((prev) => [...prev, result.tag!]);
                        return result.tag;
                      }}
                    />
                    {row.include && (error || commitError) && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-[var(--danger)]">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {commitError ?? error}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={pending}>
          {pending ? "Importando..." : `Confirmar importação (${includedRows.length})`}
        </button>
      </div>
    </div>
  );
}
