"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProtectionAction, setProtectionActiveAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { formatCentsToBRL } from "@/lib/money";
import { PROTECTION_COLUMNS } from "@/lib/patrimonio-fields";
import { fieldValue, initialFieldInputValue, renderFieldInput } from "./patrimonio-field-render";
import type { PatrimonioProtection } from "@/generated/prisma/client";

const initialState: PatrimonioActionState = {};
// +1 for "Complementação" (derived, not a form column) and +1 for actions.
const COLUMN_COUNT = PROTECTION_COLUMNS.length + 2;

function yesNo(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "Sim" : "Não";
}

/** "Complementação necessária" — never stored, always derived from the
 * two values on screen (same rule as protectionGapCents in
 * src/lib/patrimonio.ts, reimplemented inline here so this client
 * component doesn't need to import that file, which also pulls in
 * @/lib/prisma). */
function gapCents(protection: PatrimonioProtection): number | null {
  if (protection.idealValueCents == null || protection.currentValueCents == null) return null;
  return Math.max(0, protection.idealValueCents - protection.currentValueCents);
}

/** Mirrors AssetCategoryTable's edit row. "Objetivo" stays out of the
 * view-mode table (shown as a subtitle under Elemento instead, see
 * renderRow below) to keep the table from growing an 8th column, but is
 * still one of the editable fields here. */
function ProtectionEditRow({ protection, onDone }: { protection?: PatrimonioProtection; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveProtectionAction, initialState);
  // Controlled — see renderFieldInput's comment for why (React resets
  // uncontrolled form fields after any bound action call, including a
  // validation failure).
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PROTECTION_COLUMNS.map((col) => [col.key, initialFieldInputValue(col.key, protection ? fieldValue(protection, col.key) : undefined)])
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
      <td colSpan={COLUMN_COUNT} className="p-3">
        <form action={formAction}>
          {protection && <input type="hidden" name="id" value={protection.id} />}
          <div className="flex flex-wrap items-start gap-3">
            {PROTECTION_COLUMNS.map((col) => (
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

export function ProtectionTable({ protections }: { protections: PatrimonioProtection[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const active = protections.filter((p) => p.isActive);
  const inactive = protections.filter((p) => !p.isActive);

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("isActive", String(isActive));
      await setProtectionActiveAction(formData);
      router.refresh();
    });
  }

  function renderRow(protection: PatrimonioProtection) {
    if (editingId === protection.id) {
      return <ProtectionEditRow key={protection.id} protection={protection} onDone={() => setEditingId(null)} />;
    }
    const gap = gapCents(protection);
    return (
      <tr key={protection.id} className="border-t border-[var(--surface-border)]">
        <td className="px-3 py-2">
          <p className="font-medium text-[var(--text-primary)]">{protection.element}</p>
          {protection.objective && (
            <p className="max-w-xs text-xs text-[var(--text-tertiary)]" title={protection.objective}>
              {protection.objective}
            </p>
          )}
        </td>
        <td className="px-3 py-2 text-right text-[var(--text-primary)]">
          {protection.currentValueCents != null ? formatCentsToBRL(protection.currentValueCents) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-[var(--text-primary)]">
          {protection.idealValueCents != null ? formatCentsToBRL(protection.idealValueCents) : "—"}
        </td>
        <td className="px-3 py-2 text-right">
          {gap != null && gap > 0 ? (
            <span className="font-medium text-[var(--warning)]">{formatCentsToBRL(gap)}</span>
          ) : (
            <span className="text-[var(--text-faint)]">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-[var(--text-tertiary)]">{yesNo(protection.isNeeded)}</td>
        <td className="px-3 py-2 text-[var(--text-tertiary)]">{yesNo(protection.isCovered)}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingId(protection.id)}
              className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleActive(protection.id, !protection.isActive)}
              className={`text-xs font-medium ${protection.isActive ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
            >
              {protection.isActive ? "Inativar" : "Reativar"}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-[var(--muted)]">
              <th className="px-3 py-1.5">Elemento</th>
              <th className="px-3 py-1.5 text-right">Valor atual</th>
              <th className="px-3 py-1.5 text-right">Valor ideal</th>
              <th
                className="px-3 py-1.5 text-right"
                title="Diferença entre o Valor Ideal e o Valor da Proteção Atual."
              >
                Complementação
              </th>
              <th className="px-3 py-1.5">Necessidade</th>
              <th className="px-3 py-1.5">Coberto?</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {active.map(renderRow)}
            {inactive.map(renderRow)}
            {editingId === "new" && <ProtectionEditRow onDone={() => setEditingId(null)} />}
          </tbody>
        </table>
      </div>

      {editingId !== "new" && (
        <button type="button" onClick={() => setEditingId("new")} className="btn-secondary">
          + Adicionar elemento
        </button>
      )}
    </div>
  );
}
