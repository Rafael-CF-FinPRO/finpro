"use client";

import { useState, useTransition } from "react";

export type SimpleOption = { id: string; name: string };

// Import-local copy of TransactionForm.tsx's InlineCreatableSelect
// interaction (select existing + inline "+ Novo"). Not shared with it —
// that component is wired to a hidden <input> for native <form>
// submission, which the review table doesn't use (rows are submitted via
// a direct action call), and duplicating this small piece keeps zero risk
// to the working manual-entry flow.
export function CreatableSelectField({
  options,
  value,
  onSelect,
  onCreate,
  placeholder,
  emptyLabel,
  ariaLabel,
  initialNewName,
}: {
  options: SimpleOption[];
  value: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<SimpleOption | null>;
  placeholder: string;
  emptyLabel: string;
  ariaLabel: string;
  initialNewName?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState(initialNewName ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const created = await onCreate(newName);
      if (created) {
        onSelect(created.id);
        setNewName("");
        setAdding(false);
      } else {
        setError("Não foi possível adicionar.");
      }
    });
  }

  if (adding) {
    return (
      <div className="flex min-w-[9rem] flex-wrap items-center gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={placeholder}
          className="field-input flex-1 py-1 text-xs"
          autoFocus
        />
        <button
          type="button"
          className="btn-primary px-2 py-1 text-xs"
          disabled={pending || !newName.trim()}
          onClick={handleCreate}
        >
          {pending ? "..." : "Adicionar"}
        </button>
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={() => {
            setAdding(false);
            setNewName("");
            setError(null);
          }}
        >
          Cancelar
        </button>
        {error && <p className="w-full text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex min-w-[9rem] items-center gap-1">
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="field-input py-1 text-xs"
        aria-label={ariaLabel}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="whitespace-nowrap text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
        onClick={() => setAdding(true)}
      >
        + Novo
      </button>
    </div>
  );
}
