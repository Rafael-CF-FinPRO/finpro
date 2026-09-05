"use client";

import { useState } from "react";
import { computeBudgetPct } from "@/lib/budget-calc";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCategoryDisplayName } from "@/lib/category-display";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

const TOP_N = 10;

// A fixed-order categorical palette (validated colorblind-safe adjacent
// pairing), separate from CLASSIFICATION_COLORS — with up to 10 ranked
// categories on screen at once, 2 classification colors alone can't
// tell them apart. Slots beyond the 8th never get a generated hue; they
// fold into a single neutral "Outros" slice instead.
const CATEGORY_PALETTE = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];
const OTHERS_COLOR = "#a8a29e";
const MAX_DISTINCT_SLICES = CATEGORY_PALETTE.length;

// Math.cos/Math.sin can differ in their last bit between the server's and
// the browser's JS engine build, which would otherwise make the rendered
// path's `d` string mismatch between SSR and hydration — same fix as
// BudgetPieChart.tsx's own round().
function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(angleRad)), y: round(cy + r * Math.sin(angleRad)) };
}

function describeDonutSegment(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) {
  const clampedEnd = Math.min(endAngle, startAngle + 359.99);
  const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, clampedEnd);
  const startInner = polarToCartesian(cx, cy, innerR, clampedEnd);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

type PieSlice = { key: string; name: string; valueCents: number; color: string };

/** "Top 10 Categorias" — the categories that actually took the biggest
 * bite out of this month's spending, ranked by Realizado, plus a donut
 * chart of how that spending is distributed across them. Investimentos
 * is deliberately excluded (requirement: it isn't spending to rank —
 * it's the savings goal tracked elsewhere on this page). % in the list
 * is each category's own Realizado/Orçado, same as everywhere else in
 * the app — not a share of total spending (the donut is what shows
 * share). Unlike Orçamento × Realizado above, this doesn't filter to
 * isActive categories: a category deactivated after money was spent
 * through it this month still genuinely was where that money went —
 * deactivation is a forward-looking budgeting choice, not a correction
 * of this month's history. */
export function TopCategoriesRanking({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const [active, setActive] = useState<PieSlice | null>(null);

  const candidates = classifications
    .filter((cls) => cls.classification !== "INVESTIMENTOS")
    .flatMap((cls) =>
      cls.categories
        .filter((cat) => cat.realizedCents > 0)
        .map((cat) => ({ ...cat, classification: cls.classification }))
    );

  const top = withCategoryDisplayName(candidates)
    .sort((a, b) => b.realizedCents - a.realizedCents)
    .slice(0, TOP_N);

  const distinctCount = Math.min(top.length, MAX_DISTINCT_SLICES);
  const pieSlices: PieSlice[] = top.slice(0, distinctCount).map((cat, i) => ({
    key: cat.categoryId,
    name: cat.displayName,
    valueCents: cat.realizedCents,
    color: CATEGORY_PALETTE[i],
  }));
  if (top.length > MAX_DISTINCT_SLICES) {
    pieSlices.push({
      key: "outros",
      name: "Outros",
      valueCents: top.slice(MAX_DISTINCT_SLICES).reduce((sum, c) => sum + c.realizedCents, 0),
      color: OTHERS_COLOR,
    });
  }
  const totalCents = pieSlices.reduce((sum, s) => sum + s.valueCents, 0);

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerR = 50;
  const segments = pieSlices.reduce<{ slice: PieSlice; startAngle: number; endAngle: number }[]>(
    (acc, slice) => {
      const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const endAngle = startAngle + (slice.valueCents / totalCents) * 360;
      return [...acc, { slice, startAngle, endAngle }];
    },
    []
  );

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-stone-700">Top 10 Categorias</p>
      <p className="text-xs text-[var(--muted)]">Onde você mais gastou?</p>

      {top.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Nenhum gasto registrado neste mês.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribuição dos gastos entre as categorias do Top 10">
              {segments.map(({ slice, startAngle, endAngle }) => (
                <path
                  key={slice.key}
                  d={describeDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle)}
                  fill={slice.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  opacity={active && active.key !== slice.key ? 0.4 : 1}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setActive(slice)}
                  onMouseLeave={() => setActive(null)}
                >
                  <title>{`${slice.name}: ${formatCentsToBRL(slice.valueCents)}`}</title>
                </path>
              ))}
              <text x={cx} y={cy - 6} textAnchor="middle" className="fill-stone-900 text-sm font-semibold">
                {active
                  ? `${Math.round((active.valueCents / totalCents) * 100)}%`
                  : formatCentsToBRL(totalCents)}
              </text>
              <text x={cx} y={cy + 14} textAnchor="middle" className="fill-stone-500 text-xs">
                {active ? active.name : `${top.length} categorias`}
              </text>
            </svg>
          </div>

          <div className="space-y-3">
            {top.map((cat, i) => {
              const pct = computeBudgetPct(cat.realizedCents, cat.budgetedCents);
              const isOver = pct !== null && pct > 100;
              const color = CLASSIFICATION_COLORS[cat.classification as NonReceita];
              const barWidth = pct === null ? 0 : Math.min(pct, 100);
              return (
                <div key={cat.categoryId} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-right text-xs font-semibold text-[var(--muted)]">
                    {i + 1}
                  </span>
                  <IconBadge icon={getCategoryIcon(cat.name)} color={color} variant="soft" size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <p className="truncate text-sm font-medium text-stone-900">{cat.displayName}</p>
                      <p className="text-sm font-semibold text-stone-900">
                        {formatCentsToBRL(cat.realizedCents)}{" "}
                        <span
                          className={`font-normal ${isOver ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
                        >
                          ({pct === null ? "—" : `${pct.toLocaleString("pt-BR")}%`})
                        </span>
                      </p>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barWidth}%`, backgroundColor: isOver ? "var(--danger)" : color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
