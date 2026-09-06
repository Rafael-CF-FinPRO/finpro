import type { BudgetHistoryMonthRow } from "@/lib/budget";

const WIDTH = 480;
const HEIGHT = 210;
const PAD_LEFT = 30;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const Y_LABELS = [0, 50, 80, 100];

function tierColorFor(pct: number): string {
  if (pct >= 80) return "var(--success)";
  if (pct >= 50) return "var(--warning)";
  return "var(--danger)";
}

/** "Cumprimento do Orçamento" evolution — one point per month, using the
 * exact same index as the monthly view's speedometer
 * (computeOverallCompliancePct in src/lib/budget-calc.ts): Custos
 * Obrigatórios/Prazeres e Confortos score by their ceiling, Investimentos
 * by its meta, never penalized for exceeding it. Points are colored by
 * the same Crítico/Atenção/Bom tiers as the gauge; the Y axis is labeled
 * exactly at 0/50/80/100 — the tier boundaries themselves — rather than
 * generic evenly-spaced ticks, since those specific numbers are what the
 * color changes at. */
export function ComplianceEvolutionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
  if (months.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum mês no período selecionado.
      </div>
    );
  }

  const chartWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) =>
    PAD_LEFT + (months.length <= 1 ? chartWidth / 2 : (i / (months.length - 1)) * chartWidth);
  const yFor = (pct: number) => PAD_TOP + chartHeight - (Math.min(Math.max(pct, 0), 100) / 100) * chartHeight;

  const points = months.map((m, i) => `${xFor(i)},${yFor(m.compliancePct)}`).join(" ");

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-stone-700">Cumprimento do Orçamento</p>
      <div className="mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Evolução mensal do Cumprimento do Orçamento"
        >
          {Y_LABELS.map((ref) => (
            <g key={ref}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(ref)}
                y2={yFor(ref)}
                stroke="var(--surface-border)"
                strokeWidth={1}
                strokeDasharray={ref === 0 || ref === 100 ? undefined : "4 3"}
              />
              <text x={PAD_LEFT - 6} y={yFor(ref) + 3} textAnchor="end" className="fill-stone-400 text-[9px]">
                {ref}%
              </text>
            </g>
          ))}

          <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth={2} opacity={0.4} />
          {months.map((m, i) => (
            <circle key={m.monthKey} cx={xFor(i)} cy={yFor(m.compliancePct)} r={4} fill={tierColorFor(m.compliancePct)}>
              <title>{`${m.shortLabel}: ${m.compliancePct}%`}</title>
            </circle>
          ))}

          {months.map((m, i) => (
            <text
              key={m.monthKey}
              x={xFor(i)}
              y={HEIGHT - 6}
              textAnchor="middle"
              className="fill-stone-500 text-[9px]"
            >
              {m.shortLabel}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--danger)" }} />
          Crítico (&lt;50%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--warning)" }} />
          Atenção (50-79%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--success)" }} />
          Bom (≥80%)
        </span>
      </div>
    </div>
  );
}
