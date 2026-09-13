"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLiabilityActiveAction } from "@/app/actions/patrimonio";
import { formatCentsToBRL } from "@/lib/money";
import { formatDateBR } from "@/lib/dates";
import { LiabilityFormModal } from "./LiabilityFormModal";
import type { PatrimonioAsset, PatrimonioLiability } from "@/generated/prisma/client";
import type { PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

/** One table per PatrimonioLiabilityCategory (4 uses) — mirrors
 * AssetCategoryTable's structure. `assets` is the user's full active
 * asset list, passed straight through to LiabilityFormModal for the
 * "Bem relacionado" dropdown. */
export function LiabilityCategoryTable({
  category,
  liabilities,
  assets,
}: {
  category: PatrimonioLiabilityCategory;
  liabilities: PatrimonioLiability[];
  assets: PatrimonioAsset[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modalLiability, setModalLiability] = useState<PatrimonioLiability | "new" | null>(null);

  const active = liabilities.filter((l) => l.isActive);
  const inactive = liabilities.filter((l) => !l.isActive);

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("isActive", String(isActive));
      await setLiabilityActiveAction(formData);
      router.refresh();
    });
  }

  function linkedAssetName(liability: PatrimonioLiability): string | null {
    if (!liability.linkedAssetId) return null;
    return assets.find((a) => a.id === liability.linkedAssetId)?.name ?? null;
  }

  function renderRow(liability: PatrimonioLiability) {
    const linked = linkedAssetName(liability);
    return (
      <tr key={liability.id} className="border-t border-[var(--surface-border)]">
        <td className="px-3 py-2">
          <p className="font-medium text-[var(--text-primary)]">{liability.name}</p>
          {linked && <p className="text-xs text-[var(--text-tertiary)]">Vinculado a: {linked}</p>}
        </td>
        <td className="px-3 py-2 text-right font-medium text-[var(--danger)]">
          {formatCentsToBRL(liability.currentBalanceCents)}
        </td>
        <td className="px-3 py-2 text-[var(--text-tertiary)]">
          {liability.remainingInstallments != null
            ? `${liability.remainingInstallments} parcela(s) restante(s)`
            : liability.dueDate
              ? `Vence em ${formatDateBR(liability.dueDate)}`
              : "—"}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalLiability(liability)}
              className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleActive(liability.id, !liability.isActive)}
              className={`text-xs font-medium ${liability.isActive ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
            >
              {liability.isActive ? "Inativar" : "Reativar"}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      {active.length === 0 && inactive.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nenhum item cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-[var(--muted)]">
                <th className="px-3 py-1.5">Descrição</th>
                <th className="px-3 py-1.5 text-right">Saldo</th>
                <th className="px-3 py-1.5">Situação</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {active.map(renderRow)}
              {inactive.map(renderRow)}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" onClick={() => setModalLiability("new")} className="btn-secondary">
        + Adicionar
      </button>

      {modalLiability && (
        <LiabilityFormModal
          category={category}
          liability={modalLiability === "new" ? undefined : modalLiability}
          assets={assets}
          onClose={() => setModalLiability(null)}
        />
      )}
    </div>
  );
}
