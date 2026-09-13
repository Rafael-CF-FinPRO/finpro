"use client";

import type { ModuleStatus } from "@/generated/prisma/enums";

const STATUS_LABEL: Record<ModuleStatus, string> = {
  ATIVA: "Ativa",
  EM_DESENVOLVIMENTO: "Em desenvolvimento",
  BLOQUEADA: "Bloqueada",
};

const STATUS_CLASS: Record<ModuleStatus, string> = {
  ATIVA: "bg-[var(--success-bg)] text-[var(--success)]",
  EM_DESENVOLVIMENTO: "bg-[var(--warning-bg)] text-[var(--warning)]",
  BLOQUEADA: "bg-[var(--danger-bg)] text-[var(--danger)]",
};

/** Same shape as src/components/app/UserStatusControl.tsx, for a
 * SystemModule's own global status instead of a User's account status
 * — ATIVA means every consultor/cliente sees the module, BLOQUEADA
 * means no one does (even a consultor with an existing liberação),
 * EM_DESENVOLVIMENTO means only specifically-liberado consultores (see
 * src/lib/modules.ts). Submits itself on change. */
export function ModuleStatusControl({
  moduleId,
  currentStatus,
  action,
}: {
  moduleId: string;
  currentStatus: ModuleStatus;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const options: ModuleStatus[] = ["ATIVA", "EM_DESENVOLVIMENTO", "BLOQUEADA"];

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={moduleId} />
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[currentStatus]}`}
      >
        {STATUS_LABEL[currentStatus]}
      </span>
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Alterar status global do módulo"
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
