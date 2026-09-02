"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  deleteCategoryAction,
  setCategoryActiveAction,
  updateCategoryAction,
} from "@/app/actions/categories";
import { computeBudgetPct, computeBudgetStatus, centsFromPercentage } from "@/lib/budget-calc";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { BUDGET_CLASSIFICATIONS } from "@/lib/budget-calc";
import type { CategoryBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";
import { PercentageSlider } from "./PercentageSlider";
import { StatusBadge } from "./StatusBadge";

const CLASSIFICATION_OPTIONS = BUDGET_CLASSIFICATIONS;

export function CategoryAllocationEditor({
  classification,
  classificationBudgetedCents,
  categories,
  pct,
  onPctChange,
}: {
  classification: Classification;
  classificationBudgetedCents: number;
  categories: CategoryBudgetRow[];
  pct: Record<string, number>;
  onPctChange: (categoryId: string, value: number) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editClassification, setEditClassification] = useState<Classification>(classification);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const active = categories.filter((c) => c.isActive);
  const inactive = categories.filter((c) => !c.isActive);

  function refresh() {
    router.refresh();
  }

  function startEdit(cat: CategoryBudgetRow) {
    setEditingId(cat.categoryId);
    setEditName(cat.name);
    setEditClassification(classification);
    setError(null);
  }

  function handleSaveEdit(categoryId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateCategoryAction({
        id: categoryId,
        name: editName,
        classification: editClassification,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        refresh();
      }
    });
  }

  function handleToggleActive(categoryId: string, isActive: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setCategoryActiveAction({ id: categoryId, isActive });
      if (result.error) {
        setError(result.error);
      } else {
        refresh();
      }
    });
  }

  function handleDelete(categoryId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction({ id: categoryId });
      if (result.error) {
        setError(result.error);
      } else {
        refresh();
      }
    });
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await createCategoryAction({
        name: newName,
        type: "SAIDA",
        classification,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setNewName("");
        setAdding(false);
        refresh();
      }
    });
  }

  return (
    <div className="space-y-3 border-t border-[var(--surface-border)] bg-stone-50/60 p-4">
      {active.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          Nenhuma categoria ativa vinculada a esta classificação ainda.
        </p>
      )}

      {active.map((cat) => {
        const catPct = pct[cat.categoryId] ?? 0;
        const liveBudgeted = centsFromPercentage(classificationBudgetedCents, catPct);
        const livePctGasto = computeBudgetPct(cat.realizedCents, liveBudgeted);
        const liveStatus = computeBudgetStatus(cat.realizedCents, liveBudgeted);
        const isEditing = editingId === cat.categoryId;

        return (
          <div key={cat.categoryId} className="card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {isEditing ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="field-input w-40"
                  />
                  <select
                    value={editClassification}
                    onChange={(e) => setEditClassification(e.target.value as Classification)}
                    className="field-input w-auto"
                  >
                    {CLASSIFICATION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {CLASSIFICATION_LABELS[opt]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={pending || !editName.trim()}
                    onClick={() => handleSaveEdit(cat.categoryId)}
                  >
                    Salvar
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-medium text-stone-900">{cat.name}</p>
                  <div className="flex items-center gap-3">
                    {!cat.isConfigured && catPct === 0 && (
                      <span className="text-xs text-[var(--muted)]">Não configurada</span>
                    )}
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                      onClick={() => startEdit(cat)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--danger)]"
                      disabled={pending}
                      onClick={() => handleToggleActive(cat.categoryId, false)}
                    >
                      Inativar
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-2">
              <PercentageSlider
                label={cat.name}
                value={catPct}
                onChange={(v) => onPctChange(cat.categoryId, v)}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[var(--muted)]">Orçado</p>
                <p className="font-medium text-stone-900">{formatCentsToBRL(liveBudgeted)}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">Realizado</p>
                <p className="font-medium text-stone-900">{formatCentsToBRL(cat.realizedCents)}</p>
              </div>
              <div>
                <p className="text-[var(--muted)]">% Gasto</p>
                <p className="font-medium text-stone-900">
                  {livePctGasto === null ? "—" : `${livePctGasto.toLocaleString("pt-BR")}%`}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <StatusBadge status={liveStatus} />
            </div>
          </div>
        );
      })}

      {inactive.length > 0 && (
        <div className="space-y-1.5 border-t border-dashed border-[var(--surface-border)] pt-2">
          <p className="text-xs font-medium text-[var(--muted)]">Categorias inativas</p>
          {inactive.map((cat) => (
            <div key={cat.categoryId} className="flex items-center justify-between text-sm">
              <span className="text-stone-500">{cat.name}</span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                  disabled={pending}
                  onClick={() => handleToggleActive(cat.categoryId, true)}
                >
                  Reativar
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--danger)]"
                  disabled={pending}
                  onClick={() => handleDelete(cat.categoryId)}
                >
                  Excluir
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da nova categoria"
            className="field-input w-48"
            autoFocus
          />
          <button
            type="button"
            className="btn-primary"
            disabled={pending || !newName.trim()}
            onClick={handleAdd}
          >
            Adicionar
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
          onClick={() => setAdding(true)}
        >
          + Adicionar categoria
        </button>
      )}

      {error && <p className="alert-error">{error}</p>}
    </div>
  );
}
