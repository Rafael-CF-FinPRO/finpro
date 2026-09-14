"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLiabilityAction, setLiabilityActiveAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { LIABILITY_CATEGORY_COLUMNS, type LiabilityColumnKey, type PatrimonioFieldColumn } from "@/lib/patrimonio-fields";
import { fieldValue, initialFieldInputValue, renderFieldInput, renderFieldViewValue } from "./patrimonio-field-render";
import type { PatrimonioAsset, PatrimonioLiability } from "@/generated/prisma/client";
import type { PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

const initialState: PatrimonioActionState = {};

/** Mirrors AssetCategoryTable's AssetEditRow — see its comment for why
 * this is a full-width wrapping form instead of one `<td>` per column. */
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
  const columnCount = columns.length + 1;

  const active = liabilities.filter((l) => l.isActive);
  const inactive = liabilities.filter((l) => !l.isActive);
  const isEmpty = active.length === 0 && inactive.length === 0;

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("isActive", String(isActive));
      await setLiabilityActiveAction(formData);
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
        {columns.map((col) => (
          <td
            key={col.key}
            className={`px-3 py-2 ${
              col.key === "currentBalanceCents" || col.key === "creditValueCents"
                ? "text-right font-medium text-[var(--danger)]"
                : "text-[var(--text-tertiary)]"
            }`}
          >
            {renderFieldViewValue(col.key, fieldValue(liability, col.key), { assets })}
          </td>
        ))}
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingId(liability.id)}
              className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleActive(liability.id, !liability.isActive)}
              className={`text-xs font-medium ${liability.isActive ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
            >
              {liability.isActive ? "Inativar" : "Reativar"}
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
              <tr className="text-left text-xs font-medium text-[var(--muted)]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-1.5 ${
                      col.key === "currentBalanceCents" || col.key === "creditValueCents" ? "text-right" : ""
                    }`}
                    title={col.tooltip}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {active.map(renderRow)}
              {inactive.map(renderRow)}
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
