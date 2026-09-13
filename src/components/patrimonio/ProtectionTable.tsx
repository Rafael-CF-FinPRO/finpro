"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProtectionActiveAction } from "@/app/actions/patrimonio";
import { formatCentsToBRL } from "@/lib/money";
import { ProtectionFormModal } from "./ProtectionFormModal";
import type { PatrimonioProtection } from "@/generated/prisma/client";

function yesNo(value: boolean | null): string {
  if (value == null) return "—";
  return value ? "Sim" : "Não";
}

/** "Complementação necessária" — never stored, always derived from the
 * two values on screen (same rule as protectionGapCents in
 * src/lib/patrimonio.ts, reimplemented inline here so this client
 * component doesn't need to import that file, which also pulls in
 * @/lib/prisma). */
function gapCents(protection: PatrimonioProtection): number | null {
  if (protection.idealValueCents == null || protection.currentValueCents == null) return null;
  return Math.max(0, protection.idealValueCents - protection.currentValueCents);
}

export function ProtectionTable({ protections }: { protections: PatrimonioProtection[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modalProtection, setModalProtection] = useState<PatrimonioProtection | "new" | null>(null);

  const active = protections.filter((p) => p.isActive);
  const inactive = protections.filter((p) => !p.isActive);

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("isActive", String(isActive));
      await setProtectionActiveAction(formData);
      router.refresh();
    });
  }

  function renderRow(protection: PatrimonioProtection) {
    const gap = gapCents(protection);
    return (
      <tr key={protection.id} className="border-t border-[var(--surface-border)]">
        <td className="px-3 py-2">
          <p className="font-medium text-[var(--text-primary)]">{protection.element}</p>
          {protection.objective && (
            <p className="max-w-xs text-xs text-[var(--text-tertiary)]">{protection.objective}</p>
          )}
        </td>
        <td className="px-3 py-2 text-right text-[var(--text-primary)]">
          {protection.currentValueCents != null ? formatCentsToBRL(protection.currentValueCents) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-[var(--text-primary)]">
          {protection.idealValueCents != null ? formatCentsToBRL(protection.idealValueCents) : "—"}
        </td>
        <td className="px-3 py-2 text-right">
          {gap != null && gap > 0 ? (
            <span className="font-medium text-[var(--warning)]">{formatCentsToBRL(gap)}</span>
          ) : (
            <span className="text-[var(--text-faint)]">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-[var(--text-tertiary)]">{yesNo(protection.isNeeded)}</td>
        <td className="px-3 py-2 text-[var(--text-tertiary)]">{yesNo(protection.isCovered)}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalProtection(protection)}
              className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleActive(protection.id, !protection.isActive)}
              className={`text-xs font-medium ${protection.isActive ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
            >
              {protection.isActive ? "Inativar" : "Reativar"}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-[var(--muted)]">
              <th className="px-3 py-1.5">Elemento</th>
              <th className="px-3 py-1.5 text-right">Valor atual</th>
              <th className="px-3 py-1.5 text-right">Valor ideal</th>
              <th className="px-3 py-1.5 text-right">Complementação</th>
              <th className="px-3 py-1.5">Necessidade</th>
              <th className="px-3 py-1.5">Coberto?</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {active.map(renderRow)}
            {inactive.map(renderRow)}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={() => setModalProtection("new")} className="btn-secondary">
        + Adicionar elemento
      </button>

      {modalProtection && (
        <ProtectionFormModal
          protection={modalProtection === "new" ? undefined : modalProtection}
          onClose={() => setModalProtection(null)}
        />
      )}
    </div>
  );
}
