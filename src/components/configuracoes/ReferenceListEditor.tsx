"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type ReferenceItem = { id: string; name: string };

type ActionResult = { error?: string; success?: boolean };

export function ReferenceListEditor({
  emptyMessage,
  addPlaceholder,
  deleteConfirmLabel,
  items,
  onCreate,
  onUpdate,
  onDelete,
}: {
  emptyMessage: string;
  addPlaceholder: string;
  deleteConfirmLabel: (name: string) => string;
  items: ReferenceItem[];
  onCreate: (input: { name: string }) => Promise<ActionResult>;
  onUpdate: (input: { id: string; name: string }) => Promise<ActionResult>;
  onDelete: (input: { id: string }) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  function refresh() {
    router.refresh();
  }

  function startEdit(item: ReferenceItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setError(null);
  }

  function handleSaveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await onUpdate({ id, name: editName });
      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        refresh();
      }
    });
  }

  function handleDelete(item: ReferenceItem) {
    if (!confirm(deleteConfirmLabel(item.name))) return;
    setError(null);
    startTransition(async () => {
      const result = await onDelete({ id: item.id });
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
      const result = await onCreate({ name: newName });
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
    <div className="space-y-2">
      {items.length === 0 && !adding && (
        <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>
      )}

      {items.map((item) => {
        const isEditing = editingId === item.id;
        return (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--surface-border)] px-3 py-2"
          >
            {isEditing ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="field-input flex-1"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={pending || !editName.trim()}
                  onClick={() => handleSaveEdit(item.id)}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingId(null)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium text-stone-900">{item.name}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                    onClick={() => startEdit(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--danger)]"
                    disabled={pending}
                    onClick={() => handleDelete(item)}
                  >
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={addPlaceholder}
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
          + Adicionar
        </button>
      )}

      {error && <p className="alert-error">{error}</p>}
    </div>
  );
}
