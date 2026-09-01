"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_LABELS, TYPE_LABELS } from "@/lib/transaction-labels";
import { TransactionModal } from "./TransactionModal";
import { TransactionForm } from "./TransactionForm";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import type { Classification } from "@/generated/prisma/enums";

export type CategoryOption = {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA";
  classification: Classification;
  isActive: boolean;
};

export type TransactionRow = {
  id: string;
  type: "ENTRADA" | "SAIDA";
  amountCents: number;
  description: string;
  categoryId: string;
  categoryName: string;
  classification: Classification;
  dateValue: string;
  dateLabel: string;
  note: string;
};

type ModalState =
  | { mode: "create"; type: "ENTRADA" | "SAIDA" }
  | { mode: "edit"; type: "ENTRADA" | "SAIDA"; transaction: TransactionRow }
  | null;

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TypeBadge({ type }: { type: "ENTRADA" | "SAIDA" }) {
  const isIncome = type === "ENTRADA";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isIncome
          ? "bg-[var(--success-bg)] text-[var(--success)]"
          : "bg-[var(--danger-bg)] text-[var(--danger)]"
      }`}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

export function TransactionsBoard({
  categories,
  transactions,
}: {
  categories: CategoryOption[];
  transactions: TransactionRow[];
}) {
  const [modal, setModal] = useState<ModalState>(null);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setModal({ mode: "create", type: "ENTRADA" })}
          className="btn-primary flex-1"
        >
          + Registrar Entrada
        </button>
        <button
          type="button"
          onClick={() => setModal({ mode: "create", type: "SAIDA" })}
          className="btn-secondary flex-1 border-[var(--danger-border)] text-[var(--danger)] hover:bg-[var(--danger-bg)]"
        >
          + Registrar Saída
        </button>
      </div>

      <div className="card mt-4 overflow-hidden">
        {transactions.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--muted)]">
            Nenhum lançamento encontrado para os filtros selecionados.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-[var(--surface-border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Classificação</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 text-slate-600">{t.dateLabel}</td>
                    <td className="px-4 py-3">
                      <TypeBadge type={t.type} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {t.description}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.categoryName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {CLASSIFICATION_LABELS[t.classification]}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        t.type === "ENTRADA"
                          ? "text-[var(--success)]"
                          : "text-[var(--danger)]"
                      }`}
                    >
                      {t.type === "SAIDA" ? "-" : ""}
                      {formatCentsToBRL(t.amountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Editar"
                          onClick={() =>
                            setModal({ mode: "edit", type: t.type, transaction: t })
                          }
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <EditIcon />
                        </button>
                        <DeleteTransactionButton id={t.id} description={t.description} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-[var(--surface-border)] md:hidden">
              {transactions.map((t) => (
                <li key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {t.description}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {t.dateLabel} · {t.categoryName}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 font-semibold ${
                        t.type === "ENTRADA"
                          ? "text-[var(--success)]"
                          : "text-[var(--danger)]"
                      }`}
                    >
                      {t.type === "SAIDA" ? "-" : ""}
                      {formatCentsToBRL(t.amountCents)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={t.type} />
                      <span className="text-xs text-[var(--muted)]">
                        {CLASSIFICATION_LABELS[t.classification]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Editar"
                        onClick={() =>
                          setModal({ mode: "edit", type: t.type, transaction: t })
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <EditIcon />
                      </button>
                      <DeleteTransactionButton id={t.id} description={t.description} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {modal && (
        <TransactionModal
          title={
            modal.mode === "edit"
              ? `Editar ${TYPE_LABELS[modal.type].toLowerCase()}`
              : `Registrar ${TYPE_LABELS[modal.type].toLowerCase()}`
          }
          onClose={() => setModal(null)}
        >
          <TransactionForm
            type={modal.type}
            categories={categories}
            onSaved={() => setModal(null)}
            initialData={
              modal.mode === "edit"
                ? {
                    id: modal.transaction.id,
                    amountLabel: (modal.transaction.amountCents / 100)
                      .toFixed(2)
                      .replace(".", ","),
                    description: modal.transaction.description,
                    categoryId: modal.transaction.categoryId,
                    dateValue: modal.transaction.dateValue,
                    note: modal.transaction.note,
                  }
                : undefined
            }
          />
        </TransactionModal>
      )}
    </div>
  );
}
