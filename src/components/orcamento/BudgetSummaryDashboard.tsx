import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA">;

export function BudgetSummaryDashboard({
  monthlyIncomeCents,
  classifications,
}: {
  monthlyIncomeCents: number;
  classifications: ClassificationBudgetRow[];
}) {
  const totalRealizedCents = classifications.reduce((sum, c) => sum + c.realizedCents, 0);
  const resultCents = monthlyIncomeCents - totalRealizedCents;
  const isNegative = resultCents < 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {classifications.map((cls) => (
        <div key={cls.classification} className="card p-4">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: CLASSIFICATION_COLORS[cls.classification as NonReceita] }}
            />
            <p className="text-sm text-[var(--muted)]">
              {CLASSIFICATION_LABELS[cls.classification]}
            </p>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">Orçado</p>
          <p className="text-lg font-semibold text-stone-900">
            {formatCentsToBRL(cls.budgetedCents)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">Realizado</p>
          <p className="text-lg font-semibold text-stone-900">
            {formatCentsToBRL(cls.realizedCents)}
          </p>
        </div>
      ))}

      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Saldo / Resultado</p>
        <p
          className={`mt-1 text-lg font-semibold ${
            isNegative ? "text-[var(--danger)]" : "text-[var(--success)]"
          }`}
        >
          {formatCentsToBRL(resultCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">Renda − total realizado</p>
      </div>
    </div>
  );
}
