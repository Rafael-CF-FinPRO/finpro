"use client";

import { useState } from "react";
import { deleteTransactionAction } from "@/app/actions/transactions";
import { deleteSeriesOccurrenceAction } from "@/app/actions/series";

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeleteTransactionButton({
  id,
  description,
  seriesId,
}: {
  id: string;
  description: string;
  // Present only when this transaction belongs to a recurring/
  // installment series — presents "somente este / este e os próximos"
  // instead of a single confirm(), so a series is never wiped out
  // silently by one click (see deleteSeriesOccurrenceAction).
  seriesId?: string | null;
}) {
  const [choosing, setChoosing] = useState(false);

  if (!seriesId) {
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
          className="rounded-lg p-1.5 text-stone-400 hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
        </button>
      </form>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Excluir"
        onClick={() => setChoosing((v) => !v)}
        className="rounded-lg p-1.5 text-stone-400 hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
      >
        <TrashIcon />
      </button>
      {choosing && (
        <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg border border-[var(--surface-border)] bg-white p-1.5 shadow-lg">
          <form action={deleteSeriesOccurrenceAction}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              name="scope"
              value="this"
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50"
              onClick={(e) => {
                if (!confirm(`Excluir somente "${description}"?`)) e.preventDefault();
              }}
            >
              Excluir somente este
            </button>
            <button
              type="submit"
              name="scope"
              value="this_and_future"
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50"
              onClick={(e) => {
                if (!confirm(`Excluir "${description}" e os próximos ainda não pagos?`))
                  e.preventDefault();
              }}
            >
              Excluir este e os próximos
            </button>
          </form>
          <button
            type="button"
            onClick={() => setChoosing(false)}
            className="mt-1 block w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-stone-50"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
