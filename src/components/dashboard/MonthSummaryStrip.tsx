import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { ClassificationBudgetRow } from "@/lib/budget";

/** "Resumo do Mês" — the 4 headline numbers, right below the selected
 * month: Receita (all of this month's actual income, not the fixed
 * reference income used to compute Orçado elsewhere), Despesas (Custos
 * Obrigatórios + Prazeres e Confortos realizado — consumption spending
 * only), Investimentos (a destination for money, not a consumption
 * expense, kept out of Despesas), and Saldo (what's left). Same card
 * style as the Lançamentos summary strip
 * (src/components/lancamentos/SummaryCards.tsx). */
export function MonthSummaryStrip({
  realizedIncomeCents,
  classifications,
}: {
  realizedIncomeCents: number;
  classifications: ClassificationBudgetRow[];
}) {
  const realizedFor = (classification: ClassificationBudgetRow["classification"]) =>
    classifications.find((c) => c.classification === classification)?.realizedCents ?? 0;

  const custos = realizedFor("CUSTOS_OBRIGATORIOS");
  const prazeres = realizedFor("PRAZERES_E_CONFORTOS");
  const investido = realizedFor("INVESTIMENTOS");
  const despesas = custos + prazeres;
  const saldo = realizedIncomeCents - despesas - investido;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Receita</p>
        <p className="mt-1 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(realizedIncomeCents)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Despesas</p>
        <p className="mt-1 text-xl font-semibold text-[var(--danger)]">{formatCentsToBRL(despesas)}</p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Investimentos</p>
        <p className="mt-1 text-xl font-semibold" style={{ color: CLASSIFICATION_COLORS.INVESTIMENTOS }}>
          {formatCentsToBRL(investido)}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-sm text-[var(--muted)]">Saldo</p>
        <p
          className={`mt-1 text-xl font-semibold ${
            saldo < 0 ? "text-[var(--danger)]" : "text-stone-900"
          }`}
        >
          {formatCentsToBRL(saldo)}
        </p>
      </div>
    </div>
  );
}
