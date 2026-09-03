import { formatCentsToBRL } from "@/lib/money";

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy - r * Math.sin(angleRad) };
}

// A half-donut arc from `startAngle` to `endAngle`, measured the usual
// math way (0° = right, 90° = top, 180° = left) so 180→0 sweeps a full
// semicircle over the top.
function describeSemiArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = startAngle - endAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** Curved (semi-circular) progress gauge for the Saldo/Resultado card —
 * deliberately a different shape from the classification cards' straight
 * bars and the pie chart's full donut, so "the one big number" reads as
 * its own thing at a glance. Shows % of income spent as the arc fill,
 * plus the three underlying figures (Utilizado, Total, Saldo) as text. */
export function SaldoGauge({
  incomeCents,
  realizedCents,
}: {
  incomeCents: number;
  realizedCents: number;
}) {
  const saldoCents = incomeCents - realizedCents;
  const rawPct = incomeCents > 0 ? (realizedCents / incomeCents) * 100 : 0;
  const displayPct = Math.round(rawPct * 10) / 10;
  const gaugePct = Math.min(Math.max(rawPct, 0), 100);
  const isOver = rawPct > 100;
  const isNear = !isOver && rawPct >= 80;
  const color = isOver ? "var(--danger)" : isNear ? "var(--warning)" : "var(--success)";

  const size = 220;
  const cx = size / 2;
  const cy = 118;
  const r = 88;
  const strokeWidth = 18;
  // 179.99 instead of 180 avoids the degenerate case where the arc's
  // start and end points coincide and the large-arc-flag becomes
  // ambiguous (same trick as the pie chart's donut segments).
  const endAngle = 180 - (gaugePct / 100) * 179.99;

  const trackPath = describeSemiArc(cx, cy, r, 180, 0.01);
  const valuePath = gaugePct > 0 ? describeSemiArc(cx, cy, r, 180, endAngle) : null;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={cy + strokeWidth / 2 + 6} viewBox={`0 0 ${size} ${cy + strokeWidth / 2 + 6}`}>
        <path
          d={trackPath}
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 20} textAnchor="middle" className="fill-stone-900 text-2xl font-bold">
          {displayPct.toLocaleString("pt-BR")}%
        </text>
        <text x={cx} y={cy} textAnchor="middle" className="fill-stone-500 text-xs">
          da renda gasta
        </text>
      </svg>

      <div className="mt-1 grid w-full grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-[var(--muted)]">Utilizado</p>
          <p className="text-sm font-semibold text-stone-900">{formatCentsToBRL(realizedCents)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">Total</p>
          <p className="text-sm font-semibold text-stone-900">{formatCentsToBRL(incomeCents)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">Saldo</p>
          <p
            className={`text-sm font-semibold ${
              saldoCents < 0 ? "text-[var(--danger)]" : "text-[var(--success)]"
            }`}
          >
            {formatCentsToBRL(saldoCents)}
          </p>
        </div>
      </div>
    </div>
  );
}
