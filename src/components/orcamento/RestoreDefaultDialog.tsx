"use client";

import { Modal } from "./Modal";

export function RestoreDefaultDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Restaurar orçamento padrão?" onClose={onCancel}>
      <p className="text-sm text-[var(--muted)]">
        Este mês voltará a seguir sua configuração padrão.
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="rounded-lg border border-[var(--surface-border)] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Restaurando..." : "Restaurar"}
        </button>
      </div>
    </Modal>
  );
}
