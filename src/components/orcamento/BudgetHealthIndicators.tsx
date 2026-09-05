"use client";

import { useState } from "react";

const MAXIMO_COLOR = "#f97316";
const ACEITAVEL_COLOR = "#16a34a";
const IDEAL_COLOR = "#38bdf8";

/** Which of the reference zones `value` currently falls in, so the
 * bar itself is colored the same as whichever threshold it's closest
 * to having reached — e.g. a value at/better than Ideal is colored
 * with the Ideal color, one only within the Aceitável range gets the
 * Aceitável color, and one at/past Máximo (or simply worse than
 * Aceitável) gets the Máximo color. Mirrors the direction flip already
 * used for the reference numbers themselves: for a "less is better"
 * indicator the zones run low-to-high (ideal < aceitavel < maximo);
 * for Investimentos ("more is better") they run high-to-low instead.
 * `minimo` is an optional floor (only Seguros sets it): below it is
 * just as unhealthy as being past Máximo, since having no insurance at
 * all isn't "ideal" the way having little Prazeres e Confortos is. */
function zoneColorFor(
  value: number,
  maximo: number,
  aceitavel: number,
  ideal: number,
  higherIsBetter: boolean,
  minimo?: number
): string {
  if (higherIsBetter) {
    if (value >= ideal) return IDEAL_COLOR;
    if (value >= aceitavel) return ACEITAVEL_COLOR;
    return MAXIMO_COLOR;
  }
  if (minimo !== undefined && value < minimo) return MAXIMO_COLOR;
  if (value <= ideal) return IDEAL_COLOR;
  if (value <= aceitavel) return ACEITAVEL_COLOR;
  return MAXIMO_COLOR;
}

export type BudgetHealthIndicatorKey =
  | "despesasEssenciais"
  | "naoEssenciais"
  | "seguros"
  | "dividas"
  | "despesasVsReceita"
  | "investida";

// Fixed reference thresholds — not user-editable at this stage (see
// AGENTS.md task: "Não criar tela de configuração dos parâmetros").
// Every indicator except Investimentos is a "less is better" spend
// share — Máximo is the upper bound, Ideal the smallest/best figure.
// Investimentos inverts that (more invested is better), so Ideal is
// its largest reference value instead — same 3 numbers as always
// (10/20/30), just interpreted in the opposite direction.
const INDICATORS: {
  key: BudgetHealthIndicatorKey;
  label: string;
  maximo: number;
  aceitavel: number;
  ideal: number;
  // Optional floor — only Seguros sets it (see zoneColorFor above).
  minimo?: number;
  higherIsBetter: boolean;
  description: string;
}[] = [
  {
    key: "despesasEssenciais",
    label: "% Custos Obrigatórios",
    maximo: 60,
    aceitavel: 50,
    ideal: 40,
    higherIsBetter: false,
    description:
      "Mostra quanto da sua renda mensal de referência está destinado aos Custos Obrigatórios, como moradia, alimentação, saúde, transporte e outros compromissos necessários.",
  },
  {
    key: "naoEssenciais",
    label: "% Prazeres e Confortos",
    maximo: 40,
    aceitavel: 30,
    ideal: 20,
    higherIsBetter: false,
    description:
      "Mostra quanto da sua renda mensal de referência está destinado a Prazeres e Confortos, como viagens, restaurantes, lazer, assinaturas e outros gastos relacionados à qualidade de vida.",
  },
  {
    key: "seguros",
    label: "% Receita Comprometida com Seguros",
    maximo: 10,
    aceitavel: 5,
    ideal: 3,
    minimo: 1,
    higherIsBetter: false,
    description:
      "Mostra quanto da sua renda mensal de referência está comprometido com a categoria Seguros. O ideal é ter seguros, então há também um mínimo de referência: ficar abaixo dele deixa você exposto a riscos.",
  },
  {
    key: "dividas",
    label: "% Comprometido com Financiamentos e Compromissos Financeiros",
    maximo: 25,
    aceitavel: 15,
    ideal: 10,
    higherIsBetter: false,
    description:
      "Mostra quanto da sua renda mensal de referência está comprometido com financiamentos, empréstimos, consórcios, parcelamentos e outros compromissos financeiros.",
  },
  {
    key: "despesasVsReceita",
    label: "% Despesas vs Receita",
    maximo: 90,
    aceitavel: 80,
    ideal: 70,
    higherIsBetter: false,
    description:
      "Mostra quanto da sua renda mensal de referência está destinado aos Custos Obrigatórios e aos Prazeres e Confortos. Os Investimentos não entram neste indicador.",
  },
  {
    key: "investida",
    label: "% Investimentos",
    maximo: 10,
    aceitavel: 20,
    ideal: 30,
    higherIsBetter: true,
    description:
      "Mostra quanto da sua renda mensal de referência está destinado à construção de patrimônio e aos seus objetivos futuros através dos Investimentos.",
  },
];

function clampPct(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function InfoButton({
  label,
  open,
  onEnter,
  onLeave,
  onToggle,
}: {
  label: string;
  open: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[10px] leading-none text-[var(--muted)] hover:text-[var(--primary)]"
    >
      ⓘ
    </button>
  );
}

/** One horizontal bar: the user's current value as a filled track —
 * colored by which reference zone it currently falls in, with the %
 * as a data label — plus a thin vertical tick, a "cut mark", at each
 * of the 3 reference thresholds (hover/tap any of them to see its %). */
function IndicatorBar({
  label,
  description,
  higherIsBetter,
  userValue,
  maximo,
  aceitavel,
  ideal,
  minimo,
  tooltipOpen,
  onTooltipEnter,
  onTooltipLeave,
  onTooltipToggle,
}: {
  label: string;
  description: string;
  higherIsBetter: boolean;
  userValue: number;
  maximo: number;
  aceitavel: number;
  ideal: number;
  minimo?: number;
  tooltipOpen: boolean;
  onTooltipEnter: () => void;
  onTooltipLeave: () => void;
  onTooltipToggle: () => void;
}) {
  const ticks = [
    { key: "maximo", refLabel: "Máximo", value: maximo, color: MAXIMO_COLOR },
    { key: "aceitavel", refLabel: "Aceitável", value: aceitavel, color: ACEITAVEL_COLOR },
    { key: "ideal", refLabel: "Ideal", value: ideal, color: IDEAL_COLOR },
    ...(minimo !== undefined
      ? [{ key: "minimo", refLabel: "Mínimo", value: minimo, color: MAXIMO_COLOR }]
      : []),
  ];
  const barColor = zoneColorFor(userValue, maximo, aceitavel, ideal, higherIsBetter, minimo);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <p className="text-xs font-medium text-stone-600">{label}</p>
        <div className="relative">
          <InfoButton
            label={`Sobre o indicador ${label}`}
            open={tooltipOpen}
            onEnter={onTooltipEnter}
            onLeave={onTooltipLeave}
            onToggle={onTooltipToggle}
          />
          {tooltipOpen && (
            <div
              className="absolute left-0 top-5 z-20 w-64 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-[11px] leading-relaxed text-stone-600 shadow-lg"
              onMouseEnter={onTooltipEnter}
              onMouseLeave={onTooltipLeave}
            >
              <p>{description}</p>
              <p className="mt-1.5 font-medium text-stone-700">
                {higherIsBetter
                  ? "Quanto maior o valor, melhor dentro dos parâmetros de referência."
                  : "Quanto menor o valor, melhor dentro dos parâmetros de referência."}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="relative h-4 flex-1 cursor-help"
          title={`% Valor (do usuário): ${clampPct(userValue)}%`}
        >
          <div className="h-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${clampPct(userValue)}%`, backgroundColor: barColor }}
            />
          </div>
          {ticks.map((tick) => (
            <div
              key={tick.key}
              className="absolute top-1/2 flex w-3 -translate-x-1/2 -translate-y-1/2 cursor-help items-center justify-center"
              style={{ left: `${clampPct(tick.value)}%`, height: 22 }}
              title={`Valor ${tick.refLabel}: ${clampPct(tick.value)}%`}
            >
              <span
                className="h-full w-0.5 rounded-full"
                style={{ backgroundColor: tick.color }}
              />
            </div>
          ))}
        </div>
        <span
          className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums"
          style={{ color: barColor }}
        >
          {clampPct(userValue)}%
        </span>
      </div>
    </div>
  );
}

/** Read-only visual comparing each budget indicator's current value
 * (as configured in Orçamento — updates live while editing) against
 * fixed Máximo/Aceitável/Ideal reference thresholds, as horizontal
 * bars. Purely informational — never edits the underlying budget.
 * Content only (no card wrapper or title) — sits inside the same
 * panel as BudgetPieChart, which follows the same convention. */
export function BudgetHealthIndicators({
  values,
}: {
  values: Record<BudgetHealthIndicatorKey, number>;
}) {
  const [openTooltip, setOpenTooltip] = useState<BudgetHealthIndicatorKey | "legend" | null>(null);

  return (
    <div>
      <div className="space-y-4">
        {INDICATORS.map((indicator) => (
          <IndicatorBar
            key={indicator.key}
            label={indicator.label}
            description={indicator.description}
            higherIsBetter={indicator.higherIsBetter}
            userValue={values[indicator.key]}
            maximo={indicator.maximo}
            aceitavel={indicator.aceitavel}
            ideal={indicator.ideal}
            minimo={indicator.minimo}
            tooltipOpen={openTooltip === indicator.key}
            onTooltipEnter={() => setOpenTooltip(indicator.key)}
            onTooltipLeave={() => setOpenTooltip((cur) => (cur === indicator.key ? null : cur))}
            onTooltipToggle={() =>
              setOpenTooltip((cur) => (cur === indicator.key ? null : indicator.key))
            }
          />
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex flex-1 justify-between text-[10px] text-stone-400">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
        <span className="w-10 shrink-0" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-stone-600">
        <span>% Valor (do usuário) — na cor da faixa em que se encontra:</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MAXIMO_COLOR }} />
          Máximo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ACEITAVEL_COLOR }} />
          Aceitável
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: IDEAL_COLOR }} />
          Ideal
        </span>
        <span className="relative flex items-center">
          <InfoButton
            label="Como interpretar Máximo, Aceitável e Ideal"
            open={openTooltip === "legend"}
            onEnter={() => setOpenTooltip("legend")}
            onLeave={() => setOpenTooltip((cur) => (cur === "legend" ? null : cur))}
            onToggle={() => setOpenTooltip((cur) => (cur === "legend" ? null : "legend"))}
          />
          {openTooltip === "legend" && (
            <div
              className="absolute bottom-5 right-0 z-20 w-64 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-[11px] leading-relaxed text-stone-600 shadow-lg"
              onMouseEnter={() => setOpenTooltip("legend")}
              onMouseLeave={() => setOpenTooltip((cur) => (cur === "legend" ? null : cur))}
            >
              <p>
                <strong className="text-stone-700">Máximo</strong> — limite superior de referência.
              </p>
              <p className="mt-1">
                <strong className="text-stone-700">Aceitável</strong> — nível intermediário de
                referência.
              </p>
              <p className="mt-1">
                <strong className="text-stone-700">Ideal</strong> — objetivo de referência.
              </p>
              <p className="mt-1.5">
                A barra e o rótulo do valor do usuário ficam na cor da faixa (Máximo, Aceitável ou
                Ideal) mais próxima do valor atual. Na maioria dos indicadores, quanto menor o
                valor, melhor. Em Investimentos, é o contrário: quanto maior, melhor.
              </p>
            </div>
          )}
        </span>
      </div>
    </div>
  );
}
