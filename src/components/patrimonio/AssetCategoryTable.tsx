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
import { SortableTh } from "./SortableTh";
import { sortRows, sortablePrimitive, nextSortState, type SortState, type SortPrimitive } from "./sortable";
import type { PatrimonioAsset } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory } from "@/generated/prisma/enums";
import type { AssetAppreciationRate, CapitalReturn } from "@/lib/patrimonio";

const initialState: PatrimonioActionState = {};
const MUTED_DASH = <span className="text-[var(--text-faint)]">—</span>;

// All always-computed, never-editable columns — excluded from the edit
// row's generic column loop so no <input> for any of them is ever
// rendered, while staying in ASSET_CATEGORY_COLUMNS so the
// header/view-row keep showing them in their existing position.
// additionalInvestmentCents is deliberately NOT here — unlike the
// others, it's a real user-editable field (Bens Imóveis only).
const COMPUTED_COLUMN_KEYS: AssetColumnKey[] = ["annualRatePct", "rentalYieldPct", "capitalReturnPct", "capitalInvestedCents"];

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

/** "Taxa de Correção Anual (%)" — no cadastro category currently
 * renders this column (all 5 moved to CapitalReturnCell below,
 * Intangível last); left in place, unused but intact, rather than
 * removed along with its prop threading. Always computed server-side,
 * never read off the asset's own `annualRatePct` column directly.
 * Discreet color: green for valorização, red for desvalorização,
 * neutral at exactly 0%. */
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

function formatReturnPct(pct: number, suffix: "total" | "a.a."): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% ${suffix}`;
}

function returnColor(pct: number | null): string {
  if (pct === null) return "var(--text-faint)";
  if (pct > 0) return "var(--success)";
  if (pct < 0) return "var(--danger)";
  return "var(--text-secondary)";
}

/** "Retorno sobre o Capital Investido (%)" (Bens Móveis/Imóveis/
 * Colecionáveis) and "Retorno sobre o Investimento (%)" (Intangível,
 * same underlying computeCapitalReturn — it has no "Investimentos
 * Adicionais" concept, so Capital Total Investido there always reduces
 * to Valor de Compra / Investido by itself). Two lines in the same
 * cell — Retorno Total (no time dimension) and Retorno Anualizado —
 * each independently colored and independently "—" when its own
 * inputs are missing; the whole cell falls back to a single dash only
 * when Total itself can't be computed at all (Capital Total Investido
 * absent/≤0). */
function CapitalReturnCell({ capitalReturn }: { capitalReturn?: CapitalReturn }) {
  if (!capitalReturn || capitalReturn.totalPct === null) return MUTED_DASH;
  const { totalPct, annualizedPct, purchaseValueCents, additionalInvestmentCents, capitalInvestedCents, currentValueCents, purchaseDate, valueAsOfDate, days } =
    capitalReturn;
  const totalLabel = formatReturnPct(totalPct, "total");
  const annualLabel = annualizedPct !== null ? formatReturnPct(annualizedPct, "a.a.") : "—";
  return (
    <ValueTooltip
      trigger={
        <span className="font-medium">
          <span className="block" style={{ color: returnColor(totalPct) }}>
            {totalLabel}
          </span>
          <span className="block" style={{ color: returnColor(annualizedPct) }}>
            {annualLabel}
          </span>
        </span>
      }
    >
      <p className="font-semibold text-[var(--text-primary)]">Retorno sobre o Capital Investido</p>
      <p className="mt-1.5">Valor de compra: {purchaseValueCents !== null ? formatCentsToBRL(purchaseValueCents) : "—"}</p>
      {additionalInvestmentCents > 0 && <p>Investimentos adicionais: {formatCentsToBRL(additionalInvestmentCents)}</p>}
      <p>Capital total investido: {capitalInvestedCents !== null ? formatCentsToBRL(capitalInvestedCents) : "—"}</p>
      <p>Valor atual: {formatCentsToBRL(currentValueCents)}</p>
      {purchaseDate && <p>Data de compra: {formatDateBR(purchaseDate)}</p>}
      <p>Última atualização efetiva: {formatDateBR(valueAsOfDate)}</p>
      {days !== null && <p>Período: {days} dias</p>}
      <p className="mt-1.5">Retorno total: {totalLabel}</p>
      <p>Retorno anualizado: {annualLabel}</p>
      <p className="mt-1.5 text-[var(--text-faint)]">
        Retorno acumulado e anualizado do bem, considerando o capital efetivamente investido.
      </p>
    </ValueTooltip>
  );
}

/** "Capital Total Investido" — read-only, shares the same computed
 * struct as CapitalReturnCell (no separate server round trip). */
function CapitalInvestedCell({ capitalReturn }: { capitalReturn?: CapitalReturn }) {
  if (!capitalReturn || capitalReturn.capitalInvestedCents === null) return MUTED_DASH;
  return <span className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(capitalReturn.capitalInvestedCents)}</span>;
}

/** Rendimento do Aluguel's monthly %, or null when Alugado?=Não or
 * data's missing — shared by the cell (below) and the column's sort
 * value, so the two never drift apart. */
function rentalYieldMonthlyPct(asset: PatrimonioAsset): number | null {
  if (!asset.isRented || asset.rentNetValueCents == null || asset.currentValueCents <= 0) return null;
  return (asset.rentNetValueCents / asset.currentValueCents) * 100;
}

/** "Rendimento do Aluguel (%)" — Bens Imóveis only, purely derived from
 * fields already on the asset (no server round trip needed, unlike the
 * appreciation rate which depends on value-change history). Always
 * against Valor Atual, never Valor de Compra (spec section 9); "—"
 * when Alugado?=Não — a non-alugado imóvel never shows a synthetic 0%. */
function RentalYieldCell({ asset }: { asset: PatrimonioAsset }) {
  const monthlyPct = rentalYieldMonthlyPct(asset);
  if (monthlyPct === null) return MUTED_DASH;
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
  capitalReturnById,
}: {
  category: PatrimonioAssetCategory;
  assets: PatrimonioAsset[];
  assetAppreciationById: Record<string, AssetAppreciationRate>;
  capitalReturnById: Record<string, CapitalReturn>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [sortState, setSortState] = useState<SortState>(null);
  const columns = ASSET_CATEGORY_COLUMNS[category];
  // +1 for "Última Atualização" (derived from updatedAt, not a form
  // field) and +1 for Ações.
  const columnCount = columns.length + 2;

  // Excluídos (soft-deleted) never show up here — see deleteAssetAction.
  const active = assets.filter((a) => a.isActive);
  const isEmpty = active.length === 0;

  function getSortValue(asset: PatrimonioAsset, key: string): SortPrimitive {
    if (key === "annualRatePct") return assetAppreciationById[asset.id]?.ratePct ?? null;
    if (key === "rentalYieldPct") return rentalYieldMonthlyPct(asset);
    if (key === "capitalReturnPct") return capitalReturnById[asset.id]?.annualizedPct ?? capitalReturnById[asset.id]?.totalPct ?? null;
    if (key === "capitalInvestedCents") return capitalReturnById[asset.id]?.capitalInvestedCents ?? null;
    if (key === "updatedAt") return asset.updatedAt;
    return sortablePrimitive(key, fieldValue(asset, key));
  }
  const sortedActive = sortRows(active, sortState, getSortValue);

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
            ) : col.key === "capitalReturnPct" ? (
              <CapitalReturnCell capitalReturn={capitalReturnById[asset.id]} />
            ) : col.key === "capitalInvestedCents" ? (
              <CapitalInvestedCell capitalReturn={capitalReturnById[asset.id]} />
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
                  <SortableTh
                    key={col.key}
                    label={col.label}
                    sortKey={col.key}
                    sortState={sortState}
                    onSort={(key) => setSortState((prev) => nextSortState(prev, key))}
                    align={i === 0 ? "left" : "center"}
                    tooltip={col.tooltip}
                  />
                ))}
                <SortableTh
                  label="Última Atualização"
                  sortKey="updatedAt"
                  sortState={sortState}
                  onSort={(key) => setSortState((prev) => nextSortState(prev, key))}
                />
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortedActive.map(renderRow)}
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
