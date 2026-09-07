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
  /** Running remainder of income after this stage — drives the bar's
   * width, so the funnel narrows monotonically top to bottom. */
  remainderCents: number;
};

/** "Visão Geral" — a funnel of where this month's real income
 * (`receitaCents`, all ENTRADA transactions — not the fixed reference
 * income used to compute Orçado elsewhere) went: each stage shows its
 * own value and % of that income, while the bar width tracks the
 * cumulative remainder so the shape actually narrows (or, if spending
 * exceeds income, bottoms out at 0 while the text still shows the real
 * negative Saldo). Purely a cash-flow view — Investimentos is a
 * destination for money, not a consumption expense, but it's still an
 * outflow from the checking account, so it still narrows the funnel
 * like any other stage. */
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

  let remainder = receitaCents;
  const stages: Stage[] = [
    {
      key: "receita",
      label: "Receita Total",
      color: "var(--primary)",
      valueCents: receitaCents,
      remainderCents: receitaCents,
    },
    ...(
      [
        ["CUSTOS_OBRIGATORIOS", custos] as const,
        ["PRAZERES_E_CONFORTOS", prazeres] as const,
        ["INVESTIMENTOS", investido] as const,
      ]
    ).map(([classification, value]) => {
      remainder -= value;
      return {
        key: classification,
        label: CLASSIFICATION_LABELS[classification],
        icon: CLASSIFICATION_ICONS[classification],
        color: CLASSIFICATION_COLORS[classification],
        valueCents: value,
        remainderCents: remainder,
      };
    }),
    {
      key: "saldo",
      label: "Saldo Atual",
      color: saldo < 0 ? "var(--danger)" : "var(--success)",
      valueCents: saldo,
      remainderCents: saldo,
    },
  ];

  const pctOf = (cents: number) =>
    receitaCents > 0 ? Math.round((cents / receitaCents) * 1000) / 10 : 0;

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Visão Geral</p>
      <div className="mt-4 space-y-1">
        {stages.map((stage, i) => {
          const widthPct = Math.min(Math.max(pctOf(stage.remainderCents), 0), 100);
          const pctValue = pctOf(stage.valueCents);
          return (
            <div key={stage.key}>
              {i > 0 && (
                <div className="flex justify-center py-0.5 text-[var(--text-faint)]">
                  <ChevronDown size={14} />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-sm">
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
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-[var(--control-track)]">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${widthPct}%`, margin: "0 auto", backgroundColor: stage.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
