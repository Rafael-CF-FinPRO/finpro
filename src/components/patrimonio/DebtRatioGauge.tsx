import { formatCentsToBRL } from "@/lib/money";
import type { DebtRatio } from "@/lib/patrimonio";

// Same speedometer geometry as ProtectionGauge (itself mirroring
// Dashboard's "Cumprimento do Orçamento") — deliberately duplicated
// locally rather than shared: ProtectionGauge is explicitly off-limits
// here ("não alterar... Gráfico de Proteção Patrimonial"), and a shared
// primitive would mean touching that file to extract one.
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(angleRad)), y: round(cy - r * Math.sin(angleRad)) };
}

function describeSemiArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// The needle clamps at the dial's 100% end even if the real ratio goes
// higher (passivos > ativos) — only the needle position clamps, the
// displayed percentage text never does.
function angleForPct(pct: number): number {
  return 180 - (Math.min(Math.max(pct, 0), 100) / 100) * 179.99;
}

function tierFor(pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: "—", color: "var(--muted)" };
  if (pct > 40) return { label: "Elevado", color: "var(--danger)" };
  if (pct >= 20) return { label: "Atenção", color: "var(--warning)" };
  return { label: "Baixo", color: "var(--success)" };
}

const SIZE = 220;
const CX = SIZE / 2;
const CY = 118;
const R = 88;
const STROKE_WIDTH = 14;
// A small gap between zones so their rounded caps read as separate
// capsule segments instead of overlapping at the 20/40 boundaries.
const ZONE_GAP_PCT = 1.2;
const ZONES = [
  { from: 0, to: 20 - ZONE_GAP_PCT / 2, color: "var(--success)" },
  { from: 20 + ZONE_GAP_PCT / 2, to: 40 - ZONE_GAP_PCT / 2, color: "var(--warning)" },
  { from: 40 + ZONE_GAP_PCT / 2, to: 100, color: "var(--danger)" },
];
const TICKS = [0, 20, 40, 100];
const TICK_LABEL_R = R + STROKE_WIDTH / 2 + 12;

/** "Nível de Endividamento" — Passivos Totais ÷ Ativos Totais, shown as
 * a gauge next to Dados dos Passivos (never its own historical chart —
 * this is a current-moment snapshot only, matching
 * src/lib/patrimonio.ts's computeDebtRatio). */
export function DebtRatioGauge({ debtRatio }: { debtRatio: DebtRatio }) {
  const { pct, totalAssetsCents, totalLiabilitiesCents } = debtRatio;
  const value = pct ?? 0;
  const tier = tierFor(pct);

  const needleAngle = angleForPct(value);
  const tipR = R + STROKE_WIDTH / 2 + 3;
  const baseR = tipR + 10;
  const halfWidthDeg = 5;
  const trianglePoints = [
    polarToCartesian(CX, CY, tipR, needleAngle),
    polarToCartesian(CX, CY, baseR, needleAngle - halfWidthDeg),
    polarToCartesian(CX, CY, baseR, needleAngle + halfWidthDeg),
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  const pctLabel = pct === null ? "—" : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Nível de Endividamento</p>
      <div className="flex flex-col items-center">
        <svg
          width={SIZE}
          height={CY + STROKE_WIDTH / 2 + 20}
          viewBox={`0 0 ${SIZE} ${CY + STROKE_WIDTH / 2 + 20}`}
          role="img"
          aria-label="Nível de endividamento patrimonial"
        >
          {ZONES.map((zone) => (
            <path
              key={zone.color}
              d={describeSemiArc(CX, CY, R, angleForPct(zone.from), angleForPct(zone.to))}
              fill="none"
              stroke={zone.color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              opacity={0.85}
            />
          ))}
          {TICKS.map((v) => {
            const p = polarToCartesian(CX, CY, TICK_LABEL_R, angleForPct(v));
            return (
              <text
                key={v}
                x={p.x}
                y={p.y}
                textAnchor={v === 0 ? "start" : v === 100 ? "end" : "middle"}
                dominantBaseline="middle"
                className="fill-[var(--text-faint)] text-[9px]"
              >
                {v}
              </text>
            );
          })}
          <polygon points={trianglePoints} fill="var(--primary)" />
          <text x={CX} y={CY - 20} textAnchor="middle" className="fill-[var(--text-primary)] text-2xl font-bold">
            {pctLabel}
          </text>
          <text x={CX} y={CY} textAnchor="middle" className="text-xs font-medium" fill={tier.color}>
            {tier.label}
          </text>
        </svg>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 border-t border-[var(--surface-border)] pt-3 text-center">
        <div>
          <p className="text-[11px] text-[var(--muted)]">Ativos Totais</p>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{formatCentsToBRL(totalAssetsCents)}</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--muted)]">Passivos Totais</p>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{formatCentsToBRL(totalLiabilitiesCents)}</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--muted)]">Endividamento</p>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{pctLabel}</p>
        </div>
      </div>
    </div>
  );
}
