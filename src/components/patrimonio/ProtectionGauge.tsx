"use client";

import { useChartWidth } from "@/lib/use-chart-width";

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

// Proportions (as fractions of `size`) preserved from the previous
// fixed-220px version — only the overall scale is now responsive to
// the card's actual width, via useChartWidth, so the gauge fills the
// space it's given instead of floating as a small fixed shape inside
// whatever the card happens to stretch to. Clamped to a reasonable
// range: never so small it's illegible, never so large it dwarfs the
// "82%"/"Ideal" text (which stays a fixed px size).
const FALLBACK_SIZE = 220;
const MIN_SIZE = 200;
const MAX_SIZE = 300;
const CY_RATIO = 118 / 220;
const R_RATIO = 88 / 220;
const STROKE_WIDTH_RATIO = 14 / 220;

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

/** "Nível de Proteção" (spec section 9) — the primary way the
 * protection coverage percentage is shown, never just a number in a
 * card. Sized responsively to its wrapping card (useChartWidth) and
 * centered within it, both horizontally and vertically, so it reads as
 * proportional to the card's actual area instead of a small fixed
 * shape adrift in extra space. */
export function ProtectionGauge({ pct }: { pct: number | null }) {
  const { containerRef, width } = useChartWidth(FALLBACK_SIZE);
  const size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, width));
  const cx = size / 2;
  const cy = size * CY_RATIO;
  const r = size * R_RATIO;
  const strokeWidth = size * STROKE_WIDTH_RATIO;
  const tickLabelR = r + strokeWidth / 2 + 12;

  const value = pct ?? 0;
  const tier = tierFor(pct);

  const needleAngle = angleForPct(value);
  const tipR = r + strokeWidth / 2 + 3;
  const baseR = tipR + 10;
  const halfWidthDeg = 5;
  const trianglePoints = [
    polarToCartesian(cx, cy, tipR, needleAngle),
    polarToCartesian(cx, cy, baseR, needleAngle - halfWidthDeg),
    polarToCartesian(cx, cy, baseR, needleAngle + halfWidthDeg),
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <div ref={containerRef} className="flex w-full flex-1 flex-col items-center justify-center">
      <svg
        width={size}
        height={cy + strokeWidth / 2 + 20}
        viewBox={`0 0 ${size} ${cy + strokeWidth / 2 + 20}`}
        role="img"
        aria-label="Nível de proteção patrimonial"
      >
        {ZONES.map((zone) => (
          <path
            key={zone.color}
            d={describeSemiArc(cx, cy, r, angleForPct(zone.from), angleForPct(zone.to))}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}
        {TICKS.map((v) => {
          const p = polarToCartesian(cx, cy, tickLabelR, angleForPct(v));
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
        <text x={cx} y={cy - 20} textAnchor="middle" className="fill-[var(--text-primary)] text-2xl font-bold">
          {pct === null ? "—" : `${Math.round(pct)}%`}
        </text>
        <text x={cx} y={cy} textAnchor="middle" className="text-xs font-medium" fill={tier.color}>
          {tier.label}
        </text>
      </svg>
    </div>
  );
}
