"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLiabilityAction, deleteLiabilityAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { formatDateBR } from "@/lib/dates";
import { LIABILITY_CATEGORY_COLUMNS, type LiabilityColumnKey, type PatrimonioFieldColumn } from "@/lib/patrimonio-fields";
import { fieldValue, initialFieldInputValue, renderFieldInput, renderFieldViewValue } from "./patrimonio-field-render";
import type { PatrimonioAsset, PatrimonioLiability } from "@/generated/prisma/client";
import type { PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

const initialState: PatrimonioActionState = {};

function documentUrl(id: string) {
  return `/api/patrimonio/documents/liability/${id}`;
}

/** Mirrors AssetCategoryTable's AssetEditRow — see its comment for why
 * this is a full-width wrapping form instead of one `<td>` per column.
 * "Documento Anexado" is deliberately kept outside the generic
 * column-driven loop: a file input can't be a controlled React element
 * (browsers refuse to let JS set one's value), so it doesn't fit the
 * same values/onChange state every other field here uses. */
function LiabilityEditRow({
  category,
  liability,
  assets,
  columns,
  columnCount,
  onDone,
}: {
  category: PatrimonioLiabilityCategory;
  liability?: PatrimonioLiability;
  assets: PatrimonioAsset[];
  columns: PatrimonioFieldColumn<LiabilityColumnKey>[];
  columnCount: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveLiabilityAction, initialState);
  // Controlled — see renderFieldInput's comment for why (React resets
  // uncontrolled form fields after any bound action call, including a
  // validation failure).
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      columns.map((col) => [col.key, initialFieldInputValue(col.key, liability ? fieldValue(liability, col.key) : undefined)])
    )
  );
  const [removeDocument, setRemoveDocument] = useState(false);

  useEffect(() => {
    if (!state.success) return;
    const timeout = setTimeout(() => {
      onDone();
      router.refresh();
    }, 150);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <tr className="border-t border-[var(--surface-border)] bg-[var(--surface-subtle)]">
      <td colSpan={columnCount} className="p-3">
        <form action={formAction}>
          <input type="hidden" name="category" value={category} />
          {liability && <input type="hidden" name="id" value={liability.id} />}
          <div className="flex flex-wrap items-start gap-3">
            {columns.map((col) => (
              <div key={col.key} className="min-w-[150px] flex-1">
                <label className="field-label text-xs" title={col.tooltip}>
                  {col.label}
                  {col.required && <span className="text-[var(--danger)]"> *</span>}
                </label>
                {renderFieldInput(col, values[col.key], (v) => setValues((prev) => ({ ...prev, [col.key]: v })), { assets })}
                <FieldError messages={state.fieldErrors?.[col.key]} />
              </div>
            ))}
            <div className="min-w-[220px] flex-1">
              <label className="field-label text-xs">Documento Anexado</label>
              {liability?.documentFileName && !removeDocument && (
                <p className="mb-1 truncate text-xs text-[var(--text-tertiary)]">
                  <a
                    href={documentUrl(liability.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:text-[var(--primary-hover)]"
                  >
                    {liability.documentFileName}
                  </a>
                </p>
              )}
              <input name="document" type="file" className="field-input" />
              <FieldError messages={state.fieldErrors?.document} />
              {liability?.documentFileName && (
                <label className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                  <input
                    type="checkbox"
                    name="removeDocument"
                    value="true"
                    checked={removeDocument}
                    onChange={(e) => setRemoveDocument(e.target.checked)}
                  />
                  Remover documento anexado
                </label>
              )}
            </div>
          </div>
          {state.error && <p className="alert-error mt-2">{state.error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <SubmitButton>Salvar</SubmitButton>
            <button type="button" className="btn-secondary" onClick={onDone}>
              Cancelar
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

/** One table per PatrimonioLiabilityCategory (4 uses) — mirrors
 * AssetCategoryTable's structure. `assets` is the user's full active
 * asset list, used by the "Vinculado a Bem" column's dropdown. */
export function LiabilityCategoryTable({
  category,
  liabilities,
  assets,
}: {
  category: PatrimonioLiabilityCategory;
  liabilities: PatrimonioLiability[];
  assets: PatrimonioAsset[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const columns = LIABILITY_CATEGORY_COLUMNS[category];
  // +1 for Documento Anexado, +1 for Última Atualização, +1 for Ações.
  const columnCount = columns.length + 3;

  // Excluídos (soft-deleted) never show up here — see deleteLiabilityAction.
  const active = liabilities.filter((l) => l.isActive);
  const isEmpty = active.length === 0;

  function handleDelete(liability: PatrimonioLiability) {
    if (
      !confirm(
        `Excluir "${liability.name}"? Essa ação removerá o cadastro atual, mas o histórico patrimonial poderá ser preservado para fins de rastreabilidade.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", liability.id);
      await deleteLiabilityAction(formData);
      router.refresh();
    });
  }

  function renderRow(liability: PatrimonioLiability) {
    if (editingId === liability.id) {
      return (
        <LiabilityEditRow
          key={liability.id}
          category={category}
          liability={liability}
          assets={assets}
          columns={columns}
          columnCount={columnCount}
          onDone={() => setEditingId(null)}
        />
      );
    }
    return (
      <tr key={liability.id} className="border-t border-[var(--surface-border)]">
        {columns.map((col, i) => (
          <td
            key={col.key}
            className={`px-3 py-2.5 ${i === 0 ? "text-left" : "text-center"} ${
              col.key === "currentBalanceCents" || col.key === "creditValueCents"
                ? "font-semibold text-[var(--danger)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {renderFieldViewValue(col.key, fieldValue(liability, col.key), { assets })}
          </td>
        ))}
        <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">
          {liability.documentFileName ? (
            <a
              href={documentUrl(liability.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            >
              Ver documento
            </a>
          ) : (
            <span className="text-[var(--text-faint)]">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{formatDateBR(liability.updatedAt)}</td>
        <td className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setEditingId(liability.id)}
              className="text-xs font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            >
              Editar e atualizar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleDelete(liability)}
              className="text-xs font-medium text-[var(--danger)] transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      {isEmpty && editingId !== "new" ? (
        <p className="text-sm text-[var(--muted)]">Nenhum item cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
                {columns.map((col, i) => (
                  <th key={col.key} className={`px-3 py-2 ${i === 0 ? "text-left" : "text-center"}`} title={col.tooltip}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-center">Documento</th>
                <th className="px-3 py-2 text-center">Última Atualização</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {active.map(renderRow)}
              {editingId === "new" && (
                <LiabilityEditRow
                  category={category}
                  assets={assets}
                  columns={columns}
                  columnCount={columnCount}
                  onDone={() => setEditingId(null)}
                />
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingId !== "new" && (
        <button type="button" onClick={() => setEditingId("new")} className="btn-secondary">
          + Adicionar
        </button>
      )}
    </div>
  );
}
