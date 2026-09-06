import type { BudgetHistoryMonthRow } from "@/lib/budget";

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 12;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

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
 * the same Crítico/Atenção/Bom tiers as the gauge, with reference lines
 * at 50 and 80 marking the tier boundaries. */
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
      <div className="mt-3 overflow-x-auto">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="min-w-[560px]"
          role="img"
          aria-label="Evolução mensal do Cumprimento do Orçamento"
        >
          {[50, 80].map((ref) => (
            <line
              key={ref}
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(ref)}
              y2={yFor(ref)}
              stroke="var(--surface-border)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
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
              className="fill-stone-500 text-[10px]"
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
