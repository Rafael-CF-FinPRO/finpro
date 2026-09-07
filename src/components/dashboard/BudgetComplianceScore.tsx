import { computeClassificationCompliancePct, computeWeightedCompliancePct } from "@/lib/budget-calc";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

function tierFor(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Bom", color: "var(--success)" };
  if (pct >= 50) return { label: "Atenção", color: "var(--warning)" };
  return { label: "Crítico", color: "var(--danger)" };
}

// A semicircle-arc gauge (180°→0° sweeping the top) with fixed color
// zones instead of a single filled arc — different enough from the
// donut charts' full-circle geometry (src/lib/donut-geometry.ts) to
// warrant its own math rather than sharing it. Math.cos/Math.sin can
// differ in their last bit between the server's and the browser's JS
// engine build, which would otherwise make the rendered triangle's
// `points` string mismatch between SSR and hydration — same fix as the
// donut charts' own round().
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

/** "Cumprimento do Orçamento" — one index (0-100) summarizing how well
 * the month followed the budget. Weighted at two levels, both by
 * orçado: each classification's own score blends its categories
 * (computeClassificationCompliancePct in src/lib/budget-calc.ts, shared
 * with the historical view's month-by-month evolution), and the 3
 * classifications then blend into the overall index the same way — a
 * classification with a bigger orçamento moves the index more than a
 * small one. Custos
 * Obrigatórios e Prazeres e Confortos score by how well they respected
 * their ceiling; Investimentos scores by how close it got to its goal,
 * capped at 100 once reached — exceeding it never lowers the index and
 * never needs to "make up" for anything, see computeGoalCompliancePct in
 * src/lib/budget-calc.ts. Rendered as a speedometer: fixed
 * Crítico/Atenção/Bom color zones on the dial, and a small discreet
 * triangle (not a full needle) marking the current score. Deliberately
 * not its own card — it's a sub-section nested inside Orçamento ×
 * Realizado (BudgetVsRealizedPanel), not a separate "Saúde
 * Orçamentária" panel. */
export function BudgetComplianceScore({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const scores = classifications.map((cls) => ({
    classification: cls.classification,
    pct: computeClassificationCompliancePct(cls),
    budgetedCents: cls.budgetedCents,
  }));

  const overall = computeWeightedCompliancePct(scores);
  const tier = tierFor(overall);

  const size = 220;
  const cx = size / 2;
  const cy = 118;
  const r = 88;
  const strokeWidth = 14;
  // A small gap between zones so their now-rounded caps read as
  // separate capsule segments instead of overlapping into each other
  // at the 50/80 boundaries — the true 0/100 ends stay full-length.
  const ZONE_GAP_PCT = 1.2;
  const zones = [
    { from: 0, to: 50 - ZONE_GAP_PCT / 2, color: "var(--danger)" },
    { from: 50 + ZONE_GAP_PCT / 2, to: 80 - ZONE_GAP_PCT / 2, color: "var(--warning)" },
    { from: 80 + ZONE_GAP_PCT / 2, to: 100, color: "var(--success)" },
  ];
  const TICKS = [0, 50, 80, 100];
  const tickLabelR = r + strokeWidth / 2 + 12;

  const needleAngle = angleForPct(overall);
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
    <div className="mt-6 border-t border-[var(--surface-border)] pt-4">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Cumprimento do Orçamento</p>

      <div className="flex flex-col items-center">
        <svg
          width={size}
          height={cy + strokeWidth / 2 + 20}
          viewBox={`0 0 ${size} ${cy + strokeWidth / 2 + 20}`}
        >
          {zones.map((zone) => (
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
            {overall}%
          </text>
          <text x={cx} y={cy} textAnchor="middle" className="text-xs font-medium" fill={tier.color}>
            {tier.label}
          </text>
        </svg>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {scores.map((s) => (
          <div
            key={s.classification}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--surface-border)] px-3 py-2 text-xs"
          >
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
              <IconBadge
                icon={CLASSIFICATION_ICONS[s.classification as NonReceita]}
                color={CLASSIFICATION_COLORS[s.classification as NonReceita]}
                variant="soft"
                size="sm"
              />
              {CLASSIFICATION_LABELS[s.classification]}
            </span>
            <span className="font-semibold text-[var(--text-primary)]">{s.pct}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Custos Obrigatórios e Prazeres e Confortos: quanto mais dentro do limite, melhor. Investimentos:
        quanto mais perto ou acima da meta, melhor — nunca penalizado por superá-la. O índice pondera
        cada classificação e categoria pelo respectivo valor orçado.
      </p>
    </div>
  );
}
