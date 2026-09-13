"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAssetActiveAction } from "@/app/actions/patrimonio";
import { formatCentsToBRL } from "@/lib/money";
import { AssetFormModal } from "./AssetFormModal";
import type { PatrimonioAsset } from "@/generated/prisma/client";
import type { PatrimonioAssetCategory } from "@/generated/prisma/enums";

const USAGE_LABELS: Record<string, string> = { USO_PESSOAL: "Uso Pessoal", GERADOR_RENDA: "Gerador de Renda" };
const LOCATION_LABELS: Record<string, string> = { ONSHORE: "Onshore", OFFSHORE: "Offshore" };

/** One table per PatrimonioAssetCategory (5 uses total) — the columns
 * shown are the same regardless of category (name/valor/tipo/método/
 * status), the category-specific detail fields only ever show up inside
 * AssetFormModal, keeping every table scannable at a glance. */
export function AssetCategoryTable({
  category,
  assets,
}: {
  category: PatrimonioAssetCategory;
  assets: PatrimonioAsset[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modalAsset, setModalAsset] = useState<PatrimonioAsset | "new" | null>(null);

  const active = assets.filter((a) => a.isActive);
  const inactive = assets.filter((a) => !a.isActive);

  function toggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("isActive", String(isActive));
      await setAssetActiveAction(formData);
      router.refresh();
    });
  }

  function renderRow(asset: PatrimonioAsset) {
    return (
      <tr key={asset.id} className="border-t border-[var(--surface-border)]">
        <td className="px-3 py-2">
          <p className="font-medium text-[var(--text-primary)]">{asset.name}</p>
          {asset.rateLabel && <p className="text-xs text-[var(--text-tertiary)]">{asset.rateLabel}</p>}
        </td>
        <td className="px-3 py-2 text-right font-medium text-[var(--text-primary)]">
          {formatCentsToBRL(asset.currentValueCents)}
        </td>
        <td className="px-3 py-2 text-[var(--text-tertiary)]">
          {[asset.usageType ? USAGE_LABELS[asset.usageType] : null, asset.location ? LOCATION_LABELS[asset.location] : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </td>
        <td className="px-3 py-2">
          {asset.updateMethod === "PROJECAO_AUTOMATICA" ? (
            <span className="inline-flex items-center rounded-full bg-[var(--neutral-bg)] px-2 py-0.5 text-xs font-medium text-[var(--neutral)]">
              Projeção automática{asset.annualRatePct != null ? ` · ${asset.annualRatePct}% a.a.` : ""}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-faint)]">Manual</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setModalAsset(asset)}
              className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleActive(asset.id, !asset.isActive)}
              className={`text-xs font-medium ${asset.isActive ? "text-[var(--danger)]" : "text-[var(--primary)]"}`}
            >
              {asset.isActive ? "Inativar" : "Reativar"}
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
                <th className="px-3 py-1.5">Nome</th>
                <th className="px-3 py-1.5 text-right">Valor atual</th>
                <th className="px-3 py-1.5">Tipo / Localização</th>
                <th className="px-3 py-1.5">Atualização</th>
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

      <button type="button" onClick={() => setModalAsset("new")} className="btn-secondary">
        + Adicionar
      </button>

      {modalAsset && (
        <AssetFormModal
          category={category}
          asset={modalAsset === "new" ? undefined : modalAsset}
          onClose={() => setModalAsset(null)}
        />
      )}
    </div>
  );
}
