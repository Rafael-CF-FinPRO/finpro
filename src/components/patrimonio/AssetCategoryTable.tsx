"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAssetAction, deleteAssetAction, type PatrimonioActionState } from "@/app/actions/patrimonio";
import { FieldError } from "@/components/auth/FieldError";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { formatDateBR } from "@/lib/dates";
import { formatCentsToBRL } from "@/lib/money";
import { ASSET_CATEGORY_COLUMNS, type AssetColumnKey, type PatrimonioFieldColumn } from "@/lib/patrimonio-fields";
import { fieldValue, initialFieldInputValue, renderFieldInput, renderFieldViewValue } from "./patrimonio-field-render";
import { ValueTooltip } from "./ValueTooltip";
import type { PatrimonioAsset } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory } from "@/generated/prisma/enums";
import type { AssetAppreciationRate } from "@/lib/patrimonio";

const initialState: PatrimonioActionState = {};
const MUTED_DASH = <span className="text-[var(--text-faint)]">—</span>;

// Both are always-computed, never-editable columns (Taxa de Correção
// Anual and Rendimento do Aluguel) — excluded from the edit row's
// generic column loop so no <input> for them is ever rendered, while
// staying in ASSET_CATEGORY_COLUMNS so the header/view-row keep
// showing them in their existing position.
const COMPUTED_COLUMN_KEYS: AssetColumnKey[] = ["annualRatePct", "rentalYieldPct"];

/** "~X anos e Y meses" for the appreciation tooltip's "Período
 * considerado" line — average days/month, purely descriptive (the rate
 * itself is computed from exact days, never from this rounding). */
function formatElapsedYearsMonths(days: number): string {
  const totalMonths = Math.max(0, Math.round(days / 30.4368));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) {
    return `${years} ${years === 1 ? "ano" : "anos"} e ${months} ${months === 1 ? "mês" : "meses"}`;
  }
  if (years > 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

function formatAnnualRate(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`;
}

/** "Taxa de Correção Anual (%)" — always computed server-side
 * (src/lib/patrimonio.ts's computeAssetAppreciationRate, threaded down
 * via the assetAppreciationById prop), never read off the asset's own
 * `annualRatePct` column directly. Discreet color: green for
 * valorização, red for desvalorização, neutral at exactly 0%. */
function AppreciationRateCell({ appreciation }: { appreciation?: AssetAppreciationRate }) {
  if (!appreciation || appreciation.ratePct === null) return MUTED_DASH;
  const { ratePct, purchaseValueCents, currentValueCents, purchaseDate, valueAsOfDate, days } = appreciation;
  const color = ratePct > 0 ? "var(--success)" : ratePct < 0 ? "var(--danger)" : "var(--text-secondary)";
  const label = formatAnnualRate(ratePct);
  return (
    <ValueTooltip trigger={<span className="font-medium" style={{ color }}>{label}</span>}>
      <p className="font-semibold text-[var(--text-primary)]">Taxa anualizada: {label}</p>
      <p className="mt-1.5">Valor de compra: {formatCentsToBRL(purchaseValueCents)}</p>
      <p>Valor atual: {formatCentsToBRL(currentValueCents)}</p>
      <p>
        Período: {formatDateBR(purchaseDate)} a {formatDateBR(valueAsOfDate)}
      </p>
      <p>Período considerado: {formatElapsedYearsMonths(days)}</p>
      <p className="mt-1.5 text-[var(--text-faint)]">
        Taxa calculada automaticamente com base na valorização ou desvalorização anualizada entre o valor de
        aquisição e o valor atual, considerando o período efetivamente decorrido.
      </p>
    </ValueTooltip>
  );
}

/** "Rendimento do Aluguel (%)" — Bens Imóveis only, purely derived from
 * fields already on the asset (no server round trip needed, unlike the
 * appreciation rate which depends on value-change history). Always
 * against Valor Atual, never Valor de Compra (spec section 9); "—"
 * when Alugado?=Não — a non-alugado imóvel never shows a synthetic 0%. */
function RentalYieldCell({ asset }: { asset: PatrimonioAsset }) {
  if (!asset.isRented || asset.rentNetValueCents == null || asset.currentValueCents <= 0) return MUTED_DASH;
  const monthlyPct = (asset.rentNetValueCents / asset.currentValueCents) * 100;
  const annualPct = monthlyPct * 12;
  const monthlyLabel = `${monthlyPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`;
  const annualLabel = `${annualPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`;
  return (
    <ValueTooltip trigger={<span className="font-medium text-[var(--chart-saldo)]">{monthlyLabel}</span>}>
      <p className="font-semibold text-[var(--text-primary)]">Rendimento do aluguel</p>
      <p className="mt-1.5">Mensal: {monthlyLabel}</p>
      <p>Anualizado: {annualLabel}</p>
      <p className="mt-1.5 text-[var(--text-faint)]">Aluguel Líquido ÷ Valor Atual do imóvel.</p>
    </ValueTooltip>
  );
}

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
  // Taxa de Correção Anual / Rendimento do Aluguel are always-computed,
  // never manually entered (spec) — excluded here so no <input> ever
  // renders for them; they stay in `columns` only to keep driving the
  // header/view-row's position and column count.
  const formColumns = columns.filter((col) => !COMPUTED_COLUMN_KEYS.includes(col.key));
  // Controlled, not defaultValue — see renderFieldInput's comment: React
  // resets a form's uncontrolled fields after every action call, success
  // or validation failure alike, which would otherwise wipe whatever the
  // user typed the moment any single required field failed.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      formColumns.map((col) => [col.key, initialFieldInputValue(col.key, asset ? fieldValue(asset, col.key) : undefined)])
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
          {asset && <input type="hidden" name="id" value={asset.id} />}
          <div className="flex flex-wrap items-start gap-3">
            {formColumns.map((col) => (
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
  assetAppreciationById,
}: {
  category: PatrimonioAssetCategory;
  assets: PatrimonioAsset[];
  assetAppreciationById: Record<string, AssetAppreciationRate>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const columns = ASSET_CATEGORY_COLUMNS[category];
  // +1 for "Última Atualização" (derived from updatedAt, not a form
  // field) and +1 for Ações.
  const columnCount = columns.length + 2;

  // Excluídos (soft-deleted) never show up here — see deleteAssetAction.
  const active = assets.filter((a) => a.isActive);
  const isEmpty = active.length === 0;

  function handleDelete(asset: PatrimonioAsset) {
    if (
      !confirm(
        `Excluir "${asset.name}"? Essa ação removerá o cadastro atual, mas o histórico patrimonial poderá ser preservado para fins de rastreabilidade.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", asset.id);
      await deleteAssetAction(formData);
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
        {columns.map((col, i) => (
          <td
            key={col.key}
            className={`px-3 py-2.5 ${i === 0 ? "text-left" : "text-center"} ${
              col.key === "currentValueCents" ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {col.key === "annualRatePct" ? (
              <AppreciationRateCell appreciation={assetAppreciationById[asset.id]} />
            ) : col.key === "rentalYieldPct" ? (
              <RentalYieldCell asset={asset} />
            ) : (
              renderFieldViewValue(col.key, fieldValue(asset, col.key))
            )}
          </td>
        ))}
        <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{formatDateBR(asset.updatedAt)}</td>
        <td className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setEditingId(asset.id)}
              className="text-xs font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            >
              Editar e atualizar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleDelete(asset)}
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
                <th className="px-3 py-2 text-center">Última Atualização</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {active.map(renderRow)}
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
