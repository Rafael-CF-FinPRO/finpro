"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  deleteCategoryAction,
  setCategoryActiveAction,
  updateCategoryAction,
} from "@/app/actions/categories";
import { getCategoryIcon } from "@/lib/category-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";

// Stone-500 — Neutro categories have no classification color of their
// own (they never appear in the budget's classification palette, see
// src/lib/classification-colors.ts), so a neutral gray badge fits.
const NEUTRO_COLOR = "#78716c";

export type NeutroCategory = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

// Mirrors CategoryAllocationEditor's active/inactive/edit UX (the
// established pattern for Category, which always soft-deletes via
// isActive rather than hard-deleting like PaymentMethod/Tag) but
// without any budget fields — Neutro categories are organizational
// only and never participate in Orçamento.
export function NeutroCategoriesEditor({ categories }: { categories: NeutroCategory[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const active = categories.filter((c) => c.isActive);
  const inactive = categories.filter((c) => !c.isActive);

  function refresh() {
    router.refresh();
  }

  function startEdit(cat: NeutroCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description ?? "");
    setError(null);
  }

  function handleSaveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateCategoryAction({
        id,
        name: editName,
        description: editDescription,
        classification: "NEUTRA",
      });
      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        refresh();
      }
    });
  }

  function handleToggleActive(id: string, isActive: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setCategoryActiveAction({ id, isActive });
      if (result.error) {
        setError(result.error);
      } else {
        refresh();
      }
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction({ id });
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
        description: newDescription,
        type: "NEUTRO",
        classification: "NEUTRA",
      });
      if (result.error) {
        setError(result.error);
      } else {
        setNewName("");
        setNewDescription("");
        setAdding(false);
        refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      {active.length === 0 && (
        <p className="text-sm text-[var(--muted)]">Nenhuma categoria neutra ativa ainda.</p>
      )}

      {active.map((cat) => {
        const isEditing = editingId === cat.id;
        return (
          <div key={cat.id} className="rounded-lg border border-[var(--surface-border)] px-3 py-2">
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome da categoria"
                  className="field-input"
                  autoFocus
                />
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descrição — o que entra nesta categoria"
                  className="field-input"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={pending || !editName.trim() || !editDescription.trim()}
                    onClick={() => handleSaveEdit(cat.id)}
                  >
                    Salvar
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <IconBadge icon={getCategoryIcon(cat.name)} color={NEUTRO_COLOR} variant="soft" size="sm" />
                  <div>
                    <p className="font-medium text-stone-900">{cat.name}</p>
                    {cat.description && <p className="text-xs text-stone-600">{cat.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
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
                    onClick={() => handleToggleActive(cat.id, false)}
                  >
                    Inativar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {inactive.length > 0 && (
        <div className="space-y-1.5 border-t border-dashed border-[var(--surface-border)] pt-2">
          <p className="text-xs font-medium text-[var(--muted)]">Categorias inativas</p>
          {inactive.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between text-sm">
              <span className="text-stone-500">{cat.name}</span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                  disabled={pending}
                  onClick={() => handleToggleActive(cat.id, true)}
                >
                  Reativar
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--danger)]"
                  disabled={pending}
                  onClick={() => handleDelete(cat.id)}
                >
                  Excluir
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da nova categoria"
            className="field-input"
            autoFocus
          />
          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descrição — o que entra nesta categoria"
            className="field-input"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={pending || !newName.trim() || !newDescription.trim()}
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
                setNewDescription("");
              }}
            >
              Cancelar
            </button>
          </div>
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
