import type { ActivityStatus } from "@/lib/consultor";
import type { ComplianceTier } from "@/lib/budget-calc";

const ACTIVITY_LABEL: Record<ActivityStatus, string> = {
  ATIVO: "Ativo",
  ATENCAO: "Atenção",
  INATIVO: "Inativo",
  NUNCA_ACESSOU: "Nunca acessou",
};

const ACTIVITY_CLASS: Record<ActivityStatus, string> = {
  ATIVO: "bg-[var(--success-bg)] text-[var(--success)]",
  ATENCAO: "bg-[var(--warning-bg)] text-[var(--warning)]",
  INATIVO: "bg-[var(--danger-bg)] text-[var(--danger)]",
  NUNCA_ACESSOU: "bg-[var(--surface-hover)] text-[var(--muted)]",
};

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ACTIVITY_CLASS[status]}`}>
      {ACTIVITY_LABEL[status]}
    </span>
  );
}

const TIER_LABEL: Record<ComplianceTier, string> = {
  BOM: "Bom",
  ATENCAO: "Atenção",
  CRITICO: "Crítico",
};

const TIER_CLASS: Record<ComplianceTier, string> = {
  BOM: "bg-[var(--success-bg)] text-[var(--success)]",
  ATENCAO: "bg-[var(--warning-bg)] text-[var(--warning)]",
  CRITICO: "bg-[var(--danger-bg)] text-[var(--danger)]",
};

/** Reuses the exact same complianceTier() bucketing the Cliente's own
 * Cumprimento do Orçamento chart uses (src/lib/budget-calc.ts) — this
 * badge is just a label for it, never a second scoring rule. */
export function ComplianceTierBadge({
  tier,
  pct,
}: {
  tier: ComplianceTier | null;
  pct: number | null;
}) {
  if (!tier || pct === null) {
    return <span className="text-sm text-[var(--muted)]">Sem orçamento definido</span>;
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TIER_CLASS[tier]}`}>
      {TIER_LABEL[tier]} — {Math.round(pct)}%
    </span>
  );
}
