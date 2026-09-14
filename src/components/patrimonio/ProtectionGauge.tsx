// Same speedometer style as BudgetComplianceScore (Dashboard's
// "Cumprimento do Orçamento"): a thin stroke-based arc with rounded
// capsule zones and small gaps between them, tick labels at the zone
// boundaries, and a small discreet triangle marker instead of a full
// center-pivoted needle. Its own local angle math rather than
// donut-geometry.ts's convention (0°=up, clockwise) — this sweeps
// 180°→0° left-to-right over the top, matching that reference component
// exactly so the two gauges in the app read as the same visual language.
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

function angleForPct(pct: number): number {
  return 180 - (Math.min(Math.max(pct, 0), 100) / 100) * 179.99;
}

function tierFor(pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: "—", color: "var(--muted)" };
  if (pct >= 80) return { label: "Ideal", color: "var(--success)" };
  if (pct >= 50) return { label: "Parcial", color: "var(--warning)" };
  return { label: "Insuficiente", color: "var(--danger)" };
}

const SIZE = 220;
const CX = SIZE / 2;
const CY = 118;
const R = 88;
const STROKE_WIDTH = 14;
// A small gap between zones so their rounded caps read as separate
// capsule segments instead of overlapping at the 50/80 boundaries — the
// true 0/100 ends stay full-length.
const ZONE_GAP_PCT = 1.2;
const ZONES = [
  { from: 0, to: 50 - ZONE_GAP_PCT / 2, color: "var(--danger)" },
  { from: 50 + ZONE_GAP_PCT / 2, to: 80 - ZONE_GAP_PCT / 2, color: "var(--warning)" },
  { from: 80 + ZONE_GAP_PCT / 2, to: 100, color: "var(--success)" },
];
const TICKS = [0, 50, 80, 100];
const TICK_LABEL_R = R + STROKE_WIDTH / 2 + 12;

/** "Nível de Proteção" (spec section 9) — the primary way the
 * protection coverage percentage is shown, never just a number in a
 * card. */
export function ProtectionGauge({ pct }: { pct: number | null }) {
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

  return (
    <div className="flex flex-col items-center">
      <svg
        width={SIZE}
        height={CY + STROKE_WIDTH / 2 + 20}
        viewBox={`0 0 ${SIZE} ${CY + STROKE_WIDTH / 2 + 20}`}
        role="img"
        aria-label="Nível de proteção patrimonial"
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
          {pct === null ? "—" : `${Math.round(pct)}%`}
        </text>
        <text x={CX} y={CY} textAnchor="middle" className="text-xs font-medium" fill={tier.color}>
          {tier.label}
        </text>
      </svg>
    </div>
  );
}
