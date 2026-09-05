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

/** "Visão Geral" — a funnel of where this month's income went: each
 * stage shows its own value and % of income, while the bar width tracks
 * the cumulative remainder so the shape actually narrows (or, if
 * spending exceeds income, bottoms out at 0 while the text still shows
 * the real negative Saldo). Purely a cash-flow view — unlike the
 * Orçamento × Realizado panel below, it doesn't distinguish limits from
 * goals: money invested still leaves the checking account like any
 * other outflow, same reasoning as SaldoGauge. */
export function IncomeFlowFunnel({
  monthlyIncomeCents,
  classifications,
}: {
  monthlyIncomeCents: number;
  classifications: ClassificationBudgetRow[];
}) {
  const realizedFor = (classification: ClassificationBudgetRow["classification"]) =>
    classifications.find((c) => c.classification === classification)?.realizedCents ?? 0;

  const custos = realizedFor("CUSTOS_OBRIGATORIOS");
  const prazeres = realizedFor("PRAZERES_E_CONFORTOS");
  const investido = realizedFor("INVESTIMENTOS");
  const saldo = monthlyIncomeCents - custos - prazeres - investido;

  let remainder = monthlyIncomeCents;
  const stages: Stage[] = [
    {
      key: "receita",
      label: "Receita Total",
      color: "var(--primary)",
      valueCents: monthlyIncomeCents,
      remainderCents: monthlyIncomeCents,
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
    monthlyIncomeCents > 0 ? Math.round((cents / monthlyIncomeCents) * 1000) / 10 : 0;

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-stone-700">Visão Geral</p>
      <div className="mt-4 space-y-1">
        {stages.map((stage, i) => {
          const widthPct = Math.min(Math.max(pctOf(stage.remainderCents), 0), 100);
          const pctValue = pctOf(stage.valueCents);
          return (
            <div key={stage.key}>
              {i > 0 && (
                <div className="flex justify-center py-0.5 text-stone-300">
                  <ChevronDown size={14} />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-stone-700">
                  {stage.icon && <IconBadge icon={stage.icon} color={stage.color} size="sm" />}
                  {stage.label}
                </span>
                <span className="font-semibold text-stone-900">
                  {formatCentsToBRL(stage.valueCents)}{" "}
                  <span className="font-normal text-[var(--muted)]">
                    ({pctValue.toLocaleString("pt-BR")}% da receita)
                  </span>
                </span>
              </div>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-stone-100">
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
