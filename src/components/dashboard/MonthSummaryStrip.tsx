import { Wallet, TrendingDown, Scale } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
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
        <div className="flex items-center gap-2">
          <IconBadge icon={Wallet} color="var(--success)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Receita</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--success)]">
          {formatCentsToBRL(realizedIncomeCents)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Total recebido no mês</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={TrendingDown} color="var(--danger)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Despesas</p>
        </div>
        <p className="mt-2 text-xl font-semibold text-[var(--danger)]">{formatCentsToBRL(despesas)}</p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Custos Obrigatórios + Prazeres e Confortos</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge
            icon={CLASSIFICATION_ICONS.INVESTIMENTOS}
            color={CLASSIFICATION_COLORS.INVESTIMENTOS}
            variant="soft"
            size="sm"
          />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Investimentos</p>
        </div>
        <p className="mt-2 text-xl font-semibold" style={{ color: CLASSIFICATION_COLORS.INVESTIMENTOS }}>
          {formatCentsToBRL(investido)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">Total investido no mês</p>
      </div>
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <IconBadge icon={Scale} color="var(--primary)" variant="soft" size="sm" />
          <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">Saldo</p>
        </div>
        <p
          className={`mt-2 text-xl font-semibold ${
            saldo < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
          }`}
        >
          {formatCentsToBRL(saldo)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-faint)]">O que sobrou depois de tudo</p>
      </div>
    </div>
  );
}
