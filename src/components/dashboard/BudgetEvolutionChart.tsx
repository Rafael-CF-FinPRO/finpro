import { formatCentsToBRL, formatCentsCompactBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { BudgetHistoryMonthRow } from "@/lib/budget";

const SALDO_COLOR = "#2a78d6";

const SERIES: { key: keyof BudgetHistoryMonthRow; label: string; color: string }[] = [
  { key: "receitaCents", label: "Receita", color: "var(--primary)" },
  { key: "custosCents", label: "Custos Obrigatórios", color: CLASSIFICATION_COLORS.CUSTOS_OBRIGATORIOS },
  { key: "prazeresCents", label: "Prazeres e Confortos", color: CLASSIFICATION_COLORS.PRAZERES_E_CONFORTOS },
  { key: "investimentosCents", label: "Investimentos", color: CLASSIFICATION_COLORS.INVESTIMENTOS },
  { key: "saldoCents", label: "Saldo", color: SALDO_COLOR },
];

const WIDTH = 480;
const HEIGHT = 220;
const PAD_LEFT = 52;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const Y_TICKS = 4;

/** "Evolução Financeira" — Receita, Custos Obrigatórios, Prazeres e
 * Confortos, Investimentos and Saldo, one line each, over the selected
 * months. A visible Y axis (evenly-spaced gridlines, compact R$ labels)
 * and month labels on X make values and trend readable without relying
 * only on hover; a dashed zero-reference line only appears when Saldo
 * actually dips negative somewhere in the range. Hover a point (native
 * SVG title) for its exact value; the legend below names every line
 * since color alone shouldn't carry 5-way identity. Sized for a 2-up
 * grid (viewBox scales down responsively) — see Visão Histórica's
 * layout in src/app/(app)/dashboard/page.tsx. */
export function BudgetEvolutionChart({ months }: { months: BudgetHistoryMonthRow[] }) {
  if (months.length === 0) {
    return (
      <div className="card flex h-40 items-center justify-center p-4 text-sm text-[var(--muted)]">
        Nenhum mês no período selecionado.
      </div>
    );
  }

  const chartWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const allValues = months.flatMap((m) => SERIES.map((s) => m[s.key] as number));
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;

  const xFor = (i: number) =>
    PAD_LEFT + (months.length <= 1 ? chartWidth / 2 : (i / (months.length - 1)) * chartWidth);
  const yFor = (value: number) => PAD_TOP + chartHeight - ((value - minValue) / range) * chartHeight;

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => minValue + (range * i) / Y_TICKS);

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-stone-700">Evolução Financeira</p>
      <div className="mt-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Evolução mensal de Receita, Custos Obrigatórios, Prazeres e Confortos, Investimentos e Saldo"
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="var(--surface-border)"
                strokeWidth={1}
              />
              <text x={PAD_LEFT - 6} y={yFor(tick) + 3} textAnchor="end" className="fill-stone-400 text-[9px]">
                {formatCentsCompactBRL(tick)}
              </text>
            </g>
          ))}
          {minValue < 0 && (
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yFor(0)}
              y2={yFor(0)}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}

          {SERIES.map((series) => {
            const points = months.map((m, i) => `${xFor(i)},${yFor(m[series.key] as number)}`).join(" ");
            return (
              <g key={series.key}>
                <polyline points={points} fill="none" stroke={series.color} strokeWidth={2} />
                {months.map((m, i) => (
                  <circle key={m.monthKey} cx={xFor(i)} cy={yFor(m[series.key] as number)} r={3} fill={series.color}>
                    <title>{`${series.label} — ${m.shortLabel}: ${formatCentsToBRL(m[series.key] as number)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

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
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
    </div>
  );
}
