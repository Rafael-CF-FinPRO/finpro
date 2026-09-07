import { formatCentsToBRL } from "@/lib/money";
import type { TransactionsSummary } from "@/lib/transactions";

// Compact "Pago R$X · Não pago R$Y" caption shown under each card's
// headline total — plain muted text, no per-value color coding, since
// the paid/unpaid split on Saldo specifically can each independently
// land negative and a fixed "green = good" reading would mislead there.
function PaidBreakdown({ paidCents, unpaidCents }: { paidCents: number; unpaidCents: number }) {
  return (
    <p className="mt-1 text-xs text-[var(--text-faint)]">
      Pago {formatCentsToBRL(paidCents)} · Não pago {formatCentsToBRL(unpaidCents)}
    </p>
  );
}

export function SummaryCards({ summary }: { summary: TransactionsSummary }) {
  const isNegative = summary.balanceCents < 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Entradas</p>
        <p className="mt-1 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(summary.incomeCents)}
        </p>
        <PaidBreakdown paidCents={summary.incomePaidCents} unpaidCents={summary.incomeUnpaidCents} />
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Saídas</p>
        <p className="mt-1 text-xl font-semibold text-[var(--danger)]">
          {formatCentsToBRL(summary.expenseCents)}
        </p>
        <PaidBreakdown paidCents={summary.expensePaidCents} unpaidCents={summary.expenseUnpaidCents} />
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Saldo</p>
        <p
          className={`mt-1 text-xl font-semibold ${
            isNegative ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
          }`}
        >
          {formatCentsToBRL(summary.balanceCents)}
        </p>
        <PaidBreakdown paidCents={summary.balancePaidCents} unpaidCents={summary.balanceUnpaidCents} />
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Neutro</p>
        <p className="mt-1 text-xl font-semibold text-[var(--text-tertiary)]">
          {formatCentsToBRL(summary.neutroCents)}
        </p>
        <PaidBreakdown paidCents={summary.neutroPaidCents} unpaidCents={summary.neutroUnpaidCents} />
      </div>
    </div>
  );
}
