"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveProtectionAction,
  deleteProtectionAction,
  setProtectionFlagAction,
  type PatrimonioActionState,
} from "@/app/actions/patrimonio";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ToggleSwitch } from "./ToggleSwitch";
import { formatCentsToBRL } from "@/lib/money";
import { PROTECTION_COLUMNS } from "@/lib/patrimonio-fields";
import { fieldValue, initialFieldInputValue, renderFieldInput } from "./patrimonio-field-render";
import { SortableTh } from "./SortableTh";
import { sortRows, nextSortState, type SortState, type SortPrimitive } from "./sortable";
import type { PatrimonioProtection } from "@/generated/prisma/client";

const initialState: PatrimonioActionState = {};
// +1 for "Complementação" (derived, not a form column), +1 for
// Documento Anexado (also not a form column — see the comment on
// LiabilityCategoryTable's edit row for why), +1 for actions.
const COLUMN_COUNT = PROTECTION_COLUMNS.length + 3;
// Necessidade/Coberto render as ToggleSwitch, not through the generic
// renderFieldInput loop — excluded here so the loop doesn't also draw
// a <select> for them.
const FORM_COLUMNS = PROTECTION_COLUMNS.filter((col) => col.key !== "isNeeded" && col.key !== "isCovered");

function documentUrl(id: string) {
  return `/api/patrimonio/documents/protection/${id}`;
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

/** Necessidade/Coberto's view-mode toggle — flips immediately via
 * setProtectionFlagAction, no need to open "Editar e atualizar" first
 * (spec rule 5). Same optimistic-then-reconcile pattern as the "Pago"
 * toggle in Lançamentos: the switch flips locally right away and only
 * reverts if the background save actually fails. A never-set value
 * (null, e.g. a freshly-seeded elemento) simply starts at the "off"
 * state — a toggle has no third position, and the first click already
 * makes it explicit either way. */
function ProtectionFlagToggle({
  id,
  field,
  value,
  onLabel,
  offLabel,
}: {
  id: string;
  field: "isNeeded" | "isCovered";
  value: boolean | null;
  onLabel: string;
  offLabel: string;
}) {
  const [optimistic, setOptimistic] = useState(value ?? false);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      try {
        await setProtectionFlagAction({ id, field, value: next });
      } catch {
        setOptimistic(!next);
      }
    });
  }

  return <ToggleSwitch checked={optimistic} onLabel={onLabel} offLabel={offLabel} onChange={handleClick} />;
}

/** Mirrors AssetCategoryTable's edit row. "Objetivo" stays out of the
 * view-mode table (shown as a subtitle under Elemento instead, see
 * renderRow below) to keep the table from growing an 8th column.
 *
 * Editable only while CREATING a new elemento — once it exists,
 * Objetivo/Explicação becomes a fixed, structural fact about it, not a
 * day-to-day variable like Valor Atual or Necessidade (spec: "não
 * permitir alterar esses textos durante a atualização normal"). Its
 * value still travels with every "editar e atualizar" submit via a
 * hidden input carrying the unchanged existing text, so an edit never
 * wipes it — the form just doesn't render a visible field for it. */
function ProtectionEditRow({ protection, onDone }: { protection?: PatrimonioProtection; onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveProtectionAction, initialState);
  const isExisting = protection !== undefined;
  // Controlled — see renderFieldInput's comment for why (React resets
  // uncontrolled form fields after any bound action call, including a
  // validation failure). Necessidade/Coberto/Objetivo live in the same
  // object so Salvar/Cancelar treats them exactly like every other field.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PROTECTION_COLUMNS.map((col) => [col.key, initialFieldInputValue(col.key, protection ? fieldValue(protection, col.key) : undefined)])
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
      <td colSpan={COLUMN_COUNT} className="p-3">
        <form action={formAction}>
          {protection && <input type="hidden" name="id" value={protection.id} />}
          <input type="hidden" name="isNeeded" value={values.isNeeded === "true" ? "true" : "false"} />
          <input type="hidden" name="isCovered" value={values.isCovered === "true" ? "true" : "false"} />
          {isExisting && <input type="hidden" name="objective" value={values.objective} />}
          <div className="flex flex-wrap items-start gap-3">
            {FORM_COLUMNS.filter((col) => !isExisting || col.key !== "objective").map((col) => (
              <div key={col.key} className="min-w-[150px] flex-1">
                <label className="field-label text-xs" title={col.tooltip}>
                  {col.label}
                  {col.required && <span className="text-[var(--danger)]"> *</span>}
                </label>
                {renderFieldInput(col, values[col.key], (v) => setValues((prev) => ({ ...prev, [col.key]: v })))}
                <FieldError messages={state.fieldErrors?.[col.key]} />
              </div>
            ))}
            <div className="min-w-[150px] flex-1">
              <label className="field-label text-xs">Necessidade</label>
              <div className="mt-1.5">
                <ToggleSwitch
                  checked={values.isNeeded === "true"}
                  onLabel="Precisa"
                  offLabel="Não precisa"
                  onChange={() => setValues((prev) => ({ ...prev, isNeeded: prev.isNeeded === "true" ? "false" : "true" }))}
                />
              </div>
              <FieldError messages={state.fieldErrors?.isNeeded} />
            </div>
            <div className="min-w-[150px] flex-1">
              <label className="field-label text-xs">Coberto?</label>
              <div className="mt-1.5">
                <ToggleSwitch
                  checked={values.isCovered === "true"}
                  onLabel="Possui"
                  offLabel="Não possui"
                  onChange={() => setValues((prev) => ({ ...prev, isCovered: prev.isCovered === "true" ? "false" : "true" }))}
                />
              </div>
              <FieldError messages={state.fieldErrors?.isCovered} />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="field-label text-xs">Documento Anexado</label>
              {protection?.documentFileName && !removeDocument && (
                <p className="mb-1 truncate text-xs text-[var(--text-tertiary)]">
                  <a
                    href={documentUrl(protection.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:text-[var(--primary-hover)]"
                  >
                    {protection.documentFileName}
                  </a>
                </p>
              )}
              <input name="document" type="file" className="field-input" />
              <FieldError messages={state.fieldErrors?.document} />
              {protection?.documentFileName && (
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

export function ProtectionTable({ protections }: { protections: PatrimonioProtection[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [sortState, setSortState] = useState<SortState>(null);

  // Excluídos (soft-deleted) never show up here — see deleteProtectionAction.
  const active = protections.filter((p) => p.isActive);

  function getSortValue(protection: PatrimonioProtection, key: string): SortPrimitive {
    switch (key) {
      case "element":
        return protection.element;
      case "currentValueCents":
        return protection.currentValueCents;
      case "idealValueCents":
        return protection.idealValueCents;
      case "gapCents":
        return gapCents(protection);
      case "isNeeded":
        return protection.isNeeded ? 1 : 0;
      case "isCovered":
        return protection.isCovered ? 1 : 0;
      case "documentFileName":
        return protection.documentFileName ? 1 : 0;
      default:
        return null;
    }
  }
  const sortedActive = sortRows(active, sortState, getSortValue);
  const handleSort = (key: string) => setSortState((prev) => nextSortState(prev, key));

  function handleDelete(protection: PatrimonioProtection) {
    if (!confirm(`Excluir "${protection.element}"? Essa ação removerá o cadastro atual da lista.`)) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", protection.id);
      await deleteProtectionAction(formData);
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
        <td className="px-3 py-2.5 text-left">
          <p className="font-medium text-[var(--text-primary)]">{protection.element}</p>
          {protection.objective && (
            <p className="max-w-xs text-xs text-[var(--text-tertiary)]" title={protection.objective}>
              {protection.objective}
            </p>
          )}
        </td>
        <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-primary)]">
          {protection.currentValueCents != null ? formatCentsToBRL(protection.currentValueCents) : "—"}
        </td>
        <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-primary)]">
          {protection.idealValueCents != null ? formatCentsToBRL(protection.idealValueCents) : "—"}
        </td>
        <td className="px-3 py-2.5 text-center">
          {gap != null && gap > 0 ? (
            <span className="font-medium text-[var(--warning)]">{formatCentsToBRL(gap)}</span>
          ) : (
            <span className="text-[var(--text-faint)]">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          <ProtectionFlagToggle
            id={protection.id}
            field="isNeeded"
            value={protection.isNeeded}
            onLabel="Precisa"
            offLabel="Não precisa"
          />
        </td>
        <td className="px-3 py-2.5 text-center">
          <ProtectionFlagToggle
            id={protection.id}
            field="isCovered"
            value={protection.isCovered}
            onLabel="Possui"
            offLabel="Não possui"
          />
        </td>
        <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">
          {protection.documentFileName ? (
            <a
              href={documentUrl(protection.id)}
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
        <td className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setEditingId(protection.id)}
              className="text-xs font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            >
              Editar e atualizar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleDelete(protection)}
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
              <SortableTh label="Elemento" sortKey="element" sortState={sortState} onSort={handleSort} align="left" />
              <SortableTh label="Valor atual" sortKey="currentValueCents" sortState={sortState} onSort={handleSort} />
              <SortableTh label="Valor ideal" sortKey="idealValueCents" sortState={sortState} onSort={handleSort} />
              <SortableTh
                label="Complementação"
                sortKey="gapCents"
                sortState={sortState}
                onSort={handleSort}
                tooltip="Diferença entre o Valor Ideal e o Valor da Proteção Atual."
              />
              <SortableTh label="Necessidade" sortKey="isNeeded" sortState={sortState} onSort={handleSort} />
              <SortableTh label="Coberto?" sortKey="isCovered" sortState={sortState} onSort={handleSort} />
              <SortableTh label="Documento" sortKey="documentFileName" sortState={sortState} onSort={handleSort} />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sortedActive.map(renderRow)}
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
