import { ChevronDown, type LucideIcon } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { ClassificationBudgetRow } from "@/lib/budget";

type Stage = {
  key: string;
  label: string;
  icon?: LucideIcon;
  color: string;
  valueCents: number;
};

// A stage this small would otherwise all but disappear — kept
// minimally visible so a R$0 (or near-zero) stage still reads as "part
// of the sequence, just empty" rather than vanishing from the layout.
const MIN_VISIBLE_WIDTH_PCT = 6;

/** "Visão Geral" — a funnel of where this month's real income
 * (`receitaCents`, all ENTRADA transactions — not the fixed reference
 * income used to compute Orçado elsewhere) went. Each bar's width is
 * purely a comparison between the four stages themselves (value / the
 * largest of the four) — never a % of receita — so whichever stage is
 * biggest (income itself, or an overspent classification) sets the
 * funnel's full width and the rest scale against it. Saldo isn't part
 * of this comparison: it's the period's result, not a distribution
 * target, so it gets its own card below instead of a bar. */
export function IncomeFlowFunnel({
  receitaCents,
  classifications,
}: {
  receitaCents: number;
  classifications: ClassificationBudgetRow[];
}) {
  const realizedFor = (classification: ClassificationBudgetRow["classification"]) =>
    classifications.find((c) => c.classification === classification)?.realizedCents ?? 0;

  const custos = realizedFor("CUSTOS_OBRIGATORIOS");
  const prazeres = realizedFor("PRAZERES_E_CONFORTOS");
  const investido = realizedFor("INVESTIMENTOS");
  const saldo = receitaCents - custos - prazeres - investido;

  const stages: Stage[] = [
    { key: "receita", label: "Receita Total", color: "var(--primary)", valueCents: receitaCents },
    {
      key: "CUSTOS_OBRIGATORIOS",
      label: CLASSIFICATION_LABELS.CUSTOS_OBRIGATORIOS,
      icon: CLASSIFICATION_ICONS.CUSTOS_OBRIGATORIOS,
      color: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS,
      valueCents: custos,
    },
    {
      key: "PRAZERES_E_CONFORTOS",
      label: CLASSIFICATION_LABELS.PRAZERES_E_CONFORTOS,
      icon: CLASSIFICATION_ICONS.PRAZERES_E_CONFORTOS,
      color: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS,
      valueCents: prazeres,
    },
    {
      key: "INVESTIMENTOS",
      label: CLASSIFICATION_LABELS.INVESTIMENTOS,
      icon: CLASSIFICATION_ICONS.INVESTIMENTOS,
      color: CLASSIFICATION_COLORS.INVESTIMENTOS,
      valueCents: investido,
    },
  ];

  // The funnel's own reference width — the largest of the four stages
  // themselves, not receita alone (an overspent classification can
  // exceed receita and should still be what the funnel scales against).
  const maxStageValue = Math.max(...stages.map((s) => Math.abs(s.valueCents)));

  const widthPctFor = (valueCents: number) => {
    if (maxStageValue <= 0) return MIN_VISIBLE_WIDTH_PCT;
    return Math.max((Math.abs(valueCents) / maxStageValue) * 100, MIN_VISIBLE_WIDTH_PCT);
  };

  const pctOfReceita = (cents: number) =>
    receitaCents > 0 ? Math.round((cents / receitaCents) * 1000) / 10 : 0;

  const saldoPositivo = saldo >= 0;

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Visão Geral</p>

      <div className="mt-4 space-y-1">
        {stages.map((stage, i) => {
          const widthPct = widthPctFor(stage.valueCents);
          const pctValue = pctOfReceita(stage.valueCents);
          return (
            <div key={stage.key}>
              {i > 0 && (
                <div className="flex justify-center py-0.5 text-[var(--text-faint)]">
                  <ChevronDown size={14} />
                </div>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                  {stage.icon && <IconBadge icon={stage.icon} color={stage.color} size="sm" />}
                  {stage.label}
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {formatCentsToBRL(stage.valueCents)}{" "}
                  <span className="font-normal text-[var(--muted)]">
                    ({pctValue.toLocaleString("pt-BR")}% da receita)
                  </span>
                </span>
              </div>
              <div className="mt-1 h-3.5 w-full overflow-hidden rounded-full bg-[var(--control-track)]">
                <div
                  className="mx-auto h-full rounded-full transition-[width]"
                  style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-4 rounded-xl border p-3.5 sm:p-4 ${
          saldoPositivo
            ? "border-[var(--success-border)] bg-[var(--success-bg)]"
            : "border-[var(--danger-border)] bg-[var(--danger-bg)]"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p
            className={`text-xs font-medium ${
              saldoPositivo ? "text-[var(--success)]" : "text-[var(--danger)]"
            }`}
          >
            {saldoPositivo ? "Saldo disponível" : "Saldo negativo"}
          </p>
          {receitaCents > 0 && (
            <p className="text-[11px] text-[var(--muted)]">
              {pctOfReceita(saldo).toLocaleString("pt-BR")}% da receita
            </p>
          )}
        </div>
        <p
          className={`mt-1 text-2xl font-semibold ${
            saldoPositivo ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
        >
          {formatCentsToBRL(saldo)}
        </p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          {saldoPositivo
            ? "Valor restante após a distribuição da receita."
            : "As despesas e destinações superaram a receita do período."}
        </p>
      </div>
    </div>
  );
}
