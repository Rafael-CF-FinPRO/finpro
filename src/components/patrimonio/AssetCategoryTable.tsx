"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAssetAction, setAssetActiveAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ASSET_CATEGORY_COLUMNS, type AssetColumnKey, type PatrimonioFieldColumn } from "@/lib/patrimonio-fields";
import { fieldValue, initialFieldInputValue, renderFieldInput, renderFieldViewValue } from "./patrimonio-field-render";
import type { PatrimonioAsset } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory } from "@/generated/prisma/enums";

const initialState: PatrimonioActionState = {};

/** One `<tr>` spanning the whole table — used both for "+ Adicionar"
 * (asset undefined) and for editing an existing row. Fields render as a
 * wrapping label+input grid rather than one `<td>` per column: some
 * inputs (a date picker, a "Vinculado a Bem" select) need more width
 * than a narrow view-mode column would give them, and a full-width
 * form is easier to scan while typing than one cramped into the
 * table's own column grid. Never a modal, never a separate page — per
 * spec, "Adicionar"/"Editar" edit in place. */
function AssetEditRow({
  category,
  asset,
  columns,
  columnCount,
  onDone,
}: {
  category: PatrimonioAssetCategory;
  asset?: PatrimonioAsset;
  columns: PatrimonioFieldColumn<AssetColumnKey>[];
  columnCount: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveAssetAction, initialState);
  // Controlled, not defaultValue — see renderFieldInput's comment: React
  // resets a form's uncontrolled fields after every action call, success
  // or validation failure alike, which would otherwise wipe whatever the
  // user typed the moment any single required field failed.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((col) => [col.key, initialFieldInputValue(col.key, asset ? fieldValue(asset, col.key) : undefined)]))
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
          {asset && <input type="hidden" name="id" value={asset.id} />}
          <div className="flex flex-wrap items-start gap-3">
            {columns.map((col) => (
              <div key={col.key} className="min-w-[150px] flex-1">
                <label className="field-label text-xs" title={col.tooltip}>
                  {col.label}
                  {col.required && <span className="text-[var(--danger)]"> *</span>}
                </label>
                {renderFieldInput(col, values[col.key], (v) => setValues((prev) => ({ ...prev, [col.key]: v })))}
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

/** One table per PatrimonioAssetCategory (5 uses total) — columns are
 * driven entirely by ASSET_CATEGORY_COLUMNS, so each category shows
 * exactly its own spreadsheet-matching fields instead of a generic
 * Nome/Valor shape. */
export function AssetCategoryTable({
  category,
  assets,
}: {
  category: PatrimonioAssetCategory;
  assets: PatrimonioAsset[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const columns = ASSET_CATEGORY_COLUMNS[category];
  const columnCount = columns.length + 1;

  const active = assets.filter((a) => a.isActive);
  const inactive = assets.filter((a) => !a.isActive);
  const isEmpty = active.length === 0 && inactive.length === 0;

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("isActive", String(isActive));
      await setAssetActiveAction(formData);
      router.refresh();
    });
  }

  function renderRow(asset: PatrimonioAsset) {
    if (editingId === asset.id) {
      return (
        <AssetEditRow
          key={asset.id}
          category={category}
          asset={asset}
          columns={columns}
          columnCount={columnCount}
          onDone={() => setEditingId(null)}
        />
      );
    }
    return (
      <tr key={asset.id} className="border-t border-[var(--surface-border)]">
        {columns.map((col) => (
          <td
            key={col.key}
            className={`px-3 py-2 ${
              col.key === "currentValueCents" ? "text-right font-medium text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
            }`}
          >
            {renderFieldViewValue(col.key, fieldValue(asset, col.key))}
          </td>
        ))}
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingId(asset.id)}
              className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleActive(asset.id, !asset.isActive)}
              className={`text-xs font-medium ${asset.isActive ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
            >
              {asset.isActive ? "Inativar" : "Reativar"}
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
                    className={`px-3 py-1.5 ${col.key === "currentValueCents" ? "text-right" : ""}`}
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
                <AssetEditRow category={category} columns={columns} columnCount={columnCount} onDone={() => setEditingId(null)} />
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
