import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistoryMonthRow } from "@/lib/budget";

const SALDO_COLOR = "#2a78d6";
const CHART_HEIGHT = 200;
const BAR_WIDTH = 28;
const GAP = 14;

type Segment = { key: string; label: string; color: string; pct: number };

/** "Distribuição da Renda" — for each month, Custos Obrigatórios,
 * Prazeres e Confortos, Investimentos and Saldo as % of that month's
 * Receita, stacked into one 100%-reference bar per month (a dashed line
 * marks the 100% mark). A month that spent/invested more than it earned
 * simply has no Saldo segment and its bar rises past the reference line
 * — an honest way to show a deficit month without a separate chart. */
export function IncomeDistributionEvolutionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
  if (months.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum mês no período selecionado.
      </div>
    );
  }

  const pctOf = (cents: number, receitaCents: number) =>
    receitaCents > 0 ? (cents / receitaCents) * 100 : 0;

  const monthSegments = months.map((m) => {
    const custosPct = pctOf(m.custosCents, m.receitaCents);
    const prazeresPct = pctOf(m.prazeresCents, m.receitaCents);
    const investimentosPct = pctOf(m.investimentosCents, m.receitaCents);
    const spentPct = custosPct + prazeresPct + investimentosPct;
    const saldoPct = Math.max(0, 100 - spentPct);
    const segments: Segment[] = [
      { key: "custos", label: "Custos Obrigatórios", color: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS, pct: custosPct },
      { key: "prazeres", label: "Prazeres e Confortos", color: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS, pct: prazeresPct },
      { key: "investimentos", label: "Investimentos", color: CLASSIFICATION_COLORS.INVESTIMENTOS, pct: investimentosPct },
      { key: "saldo", label: "Saldo", color: SALDO_COLOR, pct: saldoPct },
    ];
    return { month: m, segments, spentPct };
  });

  const maxScale = Math.max(100, ...monthSegments.map((m) => m.spentPct));
  const width = months.length * (BAR_WIDTH + GAP) + GAP;
  const yFor = (pct: number) => (pct / maxScale) * CHART_HEIGHT;
  const height = CHART_HEIGHT + 28;
  // The 100%-of-Receita reference line — sits at the very top when
  // nothing exceeds it, and lower (leaving room above) once some
  // month's bar needs to rise past it.
  const hundredPctLineY = CHART_HEIGHT + 6 - yFor(100);

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-stone-700">Distribuição da Renda</p>
      <div className="mt-3 overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Evolução mensal da distribuição percentual da renda"
        >
          <line
            x1={0}
            x2={width}
            y1={hundredPctLineY}
            y2={hundredPctLineY}
            stroke="var(--surface-border)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text x={width - 4} y={hundredPctLineY - 4} textAnchor="end" className="fill-stone-400 text-[10px]">
            100%
          </text>

          {monthSegments.map(({ month: m, segments }, i) => {
            const x = GAP + i * (BAR_WIDTH + GAP);
            let cumulativePct = 0;
            return (
              <g key={m.monthKey}>
                {segments.map((seg) => {
                  if (seg.pct <= 0) return null;
                  const segHeight = yFor(seg.pct);
                  const y = CHART_HEIGHT + 6 - yFor(cumulativePct) - segHeight;
                  cumulativePct += seg.pct;
                  return (
                    <rect key={seg.key} x={x} y={y} width={BAR_WIDTH} height={segHeight} fill={seg.color}>
                      <title>{`${seg.label} — ${m.shortLabel}: ${Math.round(seg.pct)}%`}</title>
                    </rect>
                  );
                })}
                <text x={x + BAR_WIDTH / 2} y={height - 6} textAnchor="middle" className="fill-stone-500 text-[10px]">
                  {m.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS }} />
          Custos Obrigatórios
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS }} />
          Prazeres e Confortos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CLASSIFICATION_COLORS.INVESTIMENTOS }} />
          Investimentos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SALDO_COLOR }} />
          Saldo
        </span>
      </div>
    </div>
  );
}
