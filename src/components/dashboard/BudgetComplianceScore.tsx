import {
  computeGoalCompliancePct,
  computeLimitCompliancePct,
  isGoalClassification,
} from "@/lib/budget-calc";
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

// Same semicircle-arc convention as SaldoGauge.tsx (180°→0° sweeping the
// top), duplicated locally since this gauge draws fixed color zones
// instead of a single filled arc — a different enough shape to not share
// SaldoGauge's implementation.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy - r * Math.sin(angleRad) };
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
 * the month followed the budget, averaging a compliance score per
 * classification. Custos Obrigatórios e Prazeres e Confortos score by
 * how well they respected their ceiling; Investimentos scores by how
 * close it got to its goal, capped at 100 once reached — exceeding it
 * never lowers the index and never needs to "make up" for anything, see
 * computeGoalCompliancePct in src/lib/budget-calc.ts. Rendered as a
 * speedometer: fixed Crítico/Atenção/Bom color zones on the dial, and a
 * small discreet triangle (not a full needle) marking the current
 * score. */
export function BudgetComplianceScore({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const scores = classifications.map((cls) => ({
    classification: cls.classification,
    pct: isGoalClassification(cls.classification)
      ? computeGoalCompliancePct(cls.realizedCents, cls.budgetedCents)
      : computeLimitCompliancePct(cls.realizedCents, cls.budgetedCents),
  }));

  const overall =
    scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.pct, 0) / scores.length) : 100;
  const tier = tierFor(overall);

  const size = 220;
  const cx = size / 2;
  const cy = 118;
  const r = 88;
  const strokeWidth = 14;
  const zones = [
    { from: 0, to: 50, color: "var(--danger)" },
    { from: 50, to: 80, color: "var(--warning)" },
    { from: 80, to: 100, color: "var(--success)" },
  ];

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
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-stone-700">Cumprimento do Orçamento</p>

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
              strokeLinecap="butt"
              opacity={0.85}
            />
          ))}
          <polygon points={trianglePoints} fill="var(--primary)" />
          <text x={cx} y={cy - 20} textAnchor="middle" className="fill-stone-900 text-2xl font-bold">
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
            <span className="flex items-center gap-1.5 font-medium text-stone-700">
              <IconBadge
                icon={CLASSIFICATION_ICONS[s.classification as NonReceita]}
                color={CLASSIFICATION_COLORS[s.classification as NonReceita]}
                variant="soft"
                size="sm"
              />
              {CLASSIFICATION_LABELS[s.classification]}
            </span>
            <span className="font-semibold text-stone-900">{s.pct}%</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Custos Obrigatórios e Prazeres e Confortos: quanto mais dentro do limite, melhor. Investimentos:
        quanto mais perto ou acima da meta, melhor — nunca penalizado por superá-la.
      </p>
    </div>
  );
}
