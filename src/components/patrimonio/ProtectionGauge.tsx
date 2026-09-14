import { polarToCartesian, describeDonutSegment } from "@/lib/donut-geometry";

const WIDTH = 240;
const HEIGHT = 170;
const CX = WIDTH / 2;
const CY = 145;
const OUTER_R = 90;
const INNER_R = 64;
const NEEDLE_R = OUTER_R - 10;

// 0-49 insuficiente, 50-79 parcial, 80-100 próximo do ideal/completo —
// the last two spec-named tiers (80-99 and 100) share one band: a
// gauge arc can't visually distinguish a single point (100%) from the
// range just below it, so the number itself (not the color) carries
// that distinction.
const BANDS = [
  { from: 0, to: 50, color: "var(--danger)", label: "Insuficiente" },
  { from: 50, to: 80, color: "var(--warning)", label: "Parcial" },
  { from: 80, to: 100, color: "var(--success)", label: "Ideal" },
];

/** angleDeg=0 is "up" in donut-geometry's convention (12 o'clock,
 * clockwise) — offsetting by -90 turns pct=0 into "9 o'clock" (270°)
 * and pct=100 into "3 o'clock" (450 ≡ 90°), sweeping over the top as
 * pct grows, the standard speedometer layout. */
function angleForPct(pct: number): number {
  return 270 + (Math.min(Math.max(pct, 0), 100) / 100) * 180;
}

/** "Velocímetro de Proteção" (spec section 9) — a hand-rolled SVG gauge
 * (same primitives as every donut in this app, just swept as a half
 * circle instead of a full one), the primary way the protection
 * coverage percentage is shown — never just a number in a card. */
export function ProtectionGauge({ pct }: { pct: number | null }) {
  const value = pct ?? 0;
  const needleAngle = angleForPct(value);
  const tip = polarToCartesian(CX, CY, NEEDLE_R, needleAngle);
  const base1 = polarToCartesian(CX, CY, 9, needleAngle + 90);
  const base2 = polarToCartesian(CX, CY, 9, needleAngle - 90);

  return (
    <div className="flex flex-col items-center">
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Velocímetro de proteção patrimonial">
        {BANDS.map((band) => (
          <path
            key={band.label}
            d={describeDonutSegment(CX, CY, OUTER_R, INNER_R, angleForPct(band.from), angleForPct(band.to))}
            fill={band.color}
            opacity={0.85}
          />
        ))}
        <polygon points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`} fill="var(--text-primary)" />
        <circle cx={CX} cy={CY} r={9} fill="var(--text-primary)" />
        <text x={CX} y={CY - 32} textAnchor="middle" className="fill-[var(--text-primary)] text-3xl font-bold">
          {pct === null ? "—" : `${Math.round(pct)}%`}
        </text>
        <text x={CX} y={CY - 12} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
          Meta: 100%
        </text>
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        {BANDS.map((band) => (
          <span key={band.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: band.color }} />
            {band.label}
          </span>
        ))}
      </div>
    </div>
  );
}
