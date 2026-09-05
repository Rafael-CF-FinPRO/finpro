import type { BudgetStatus, GoalStatus } from "@/lib/budget-calc";

const GOAL_STATUS_META: Record<GoalStatus, { label: string; className: string }> = {
  EM_PROGRESSO: { label: "Em progresso", className: "bg-stone-100 text-stone-600" },
  QUASE_LA: { label: "Quase lá", className: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  META_ATINGIDA: { label: "Meta atingida", className: "bg-[var(--success-bg)] text-[var(--success)]" },
};

// Two mutually-exclusive shapes: a spend-with-ceiling classification
// passes `status`, a goal classification (Investimentos) passes
// `goalStatus` instead — never both, see isGoalClassification.
export function StatusBadge({
  status,
  goalStatus,
}: {
  status?: BudgetStatus;
  goalStatus?: GoalStatus;
}) {
  if (goalStatus) {
    const meta = GOAL_STATUS_META[goalStatus];
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
        {meta.label}
      </span>
    );
  }
  const isWithin = status === "DENTRO";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isWithin
          ? "bg-[var(--success-bg)] text-[var(--success)]"
          : "bg-[var(--danger-bg)] text-[var(--danger)]"
      }`}
    >
      {isWithin ? "Dentro" : "Fora"}
    </span>
  );
}
