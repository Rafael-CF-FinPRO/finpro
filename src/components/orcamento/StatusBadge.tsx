import type { BudgetStatus } from "@/lib/budget-calc";

export function StatusBadge({ status }: { status: BudgetStatus }) {
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
