import { formatCentsToBRL } from "@/lib/money";
import type { TransactionsSummary } from "@/lib/transactions";

export function SummaryCards({ summary }: { summary: TransactionsSummary }) {
  const isNegative = summary.balanceCents < 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Entradas</p>
        <p className="mt-1 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(summary.incomeCents)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Saídas</p>
        <p className="mt-1 text-xl font-semibold text-[var(--danger)]">
          {formatCentsToBRL(summary.expenseCents)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Saldo</p>
        <p
          className={`mt-1 text-xl font-semibold ${
            isNegative ? "text-[var(--danger)]" : "text-stone-900"
          }`}
        >
          {formatCentsToBRL(summary.balanceCents)}
        </p>
      </div>
    </div>
  );
}
