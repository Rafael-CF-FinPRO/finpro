"use client";

import { deleteTransactionAction } from "@/app/actions/transactions";

export function DeleteTransactionButton({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  return (
    <form
      action={deleteTransactionAction}
      onSubmit={(e) => {
        if (!confirm(`Excluir o lançamento "${description}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label="Excluir"
        className="rounded-lg p-1.5 text-slate-400 hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
