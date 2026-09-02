"use client";

import { formatMonthKeyLabel } from "@/lib/dates";
import { Modal } from "./Modal";

export function ApplyScopeDialog({
  monthKey,
  pending,
  onCancel,
  onChoose,
}: {
  monthKey: string;
  pending: boolean;
  onCancel: () => void;
  onChoose: (scope: "month" | "default") => void;
}) {
  const monthLabel = formatMonthKeyLabel(monthKey);

  return (
    <Modal title="Como deseja aplicar esta alteração?" onClose={onCancel}>
      <div className="space-y-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => onChoose("month")}
          className="block w-full rounded-xl border border-[var(--surface-border)] p-4 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <p className="font-semibold text-stone-900">Somente este mês</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Altera apenas o orçamento de {monthLabel}.
          </p>
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => onChoose("default")}
          className="block w-full rounded-xl border border-[var(--surface-border)] p-4 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <p className="font-semibold text-stone-900">Este mês e todos os próximos</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Atualiza seu orçamento padrão e aplica essa nova configuração a {monthLabel} e aos
            próximos meses. Meses com personalização própria continuam com sua configuração
            específica.
          </p>
        </button>
      </div>

      {pending && (
        <p className="mt-4 text-center text-sm text-[var(--muted)]">Salvando...</p>
      )}
    </Modal>
  );
}
