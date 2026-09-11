"use client";

import type { UserStatus } from "@/generated/prisma/enums";

const STATUS_LABEL: Record<UserStatus, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  BLOQUEADO: "Bloqueado",
};

const STATUS_CLASS: Record<UserStatus, string> = {
  ATIVO: "bg-[var(--success-bg)] text-[var(--success)]",
  INATIVO: "bg-[var(--surface-hover)] text-[var(--muted)]",
  BLOQUEADO: "bg-[var(--danger-bg)] text-[var(--danger)]",
};

/** "Status da conta" — INATIVO/BLOQUEADO both block login identically
 * (see getSession, src/lib/session.ts); the two labels exist only so an
 * ADMIN can tell "paused" apart from "blocked" at a glance. `options`
 * controls which choices are offered (a CONSULTOR setting their own
 * cliente's status only gets ATIVO/INATIVO — BLOQUEADO is ADMIN-only,
 * see setClientStatusAction in src/app/actions/consultor.ts). Submits
 * itself on change, same one-field-form spirit as the old
 * toggleConsultorActiveAction button it replaces. */
export function UserStatusControl({
  userId,
  currentStatus,
  options,
  action,
}: {
  userId: string;
  currentStatus: UserStatus;
  options: UserStatus[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={userId} />
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[currentStatus]}`}
      >
        {STATUS_LABEL[currentStatus]}
      </span>
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Alterar status da conta"
        className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {STATUS_LABEL[opt]}
          </option>
        ))}
      </select>
    </form>
  );
}
