"use client";

import { useState } from "react";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { formatCentsToBRL } from "@/lib/money";
import { IconBadge } from "./IconBadge";
import type { Classification } from "@/generated/prisma/enums";

type Slice = {
  classification: Exclude<Classification, "RECEITA" | "NEUTRA">;
  percentage: number;
  budgetedCents: number;
};

// Math.cos/Math.sin can differ in their last bit between the server's and
// the browser's JS engine build, which would otherwise make the rendered
// path's `d` string mismatch between SSR and hydration. Rounding collapses
// that ULP-level noise before it becomes an observable string difference.
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

export function BudgetPieChart({ slices }: { slices: Slice[] }) {
  const [active, setActive] = useState<Slice | null>(null);

  const total = slices.reduce((s, sl) => s + sl.percentage, 0);
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 100;
  const innerR = 62;

  const segments = slices
    .filter((s) => s.percentage > 0)
    .reduce<{ slice: Slice; startAngle: number; endAngle: number }[]>((acc, slice) => {
      const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const endAngle = startAngle + (slice.percentage / 100) * 360;
      return [...acc, { slice, startAngle, endAngle }];
    }, []);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[var(--muted)]">
        Configure a distribuição para ver o gráfico.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Distribuição do orçamento entre classificações"
      >
        {segments.map(({ slice, startAngle, endAngle }) => (
          <path
            key={slice.classification}
            d={describeDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle)}
            fill={CLASSIFICATION_COLORS[slice.classification]}
            stroke="var(--surface)"
            strokeWidth={2}
            opacity={active && active.classification !== slice.classification ? 0.4 : 1}
            className="cursor-pointer transition-opacity"
            onMouseEnter={() => setActive(slice)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive((prev) => (prev?.classification === slice.classification ? null : slice))}
          >
            <title>{`${CLASSIFICATION_LABELS[slice.classification]}: ${slice.percentage}% (${formatCentsToBRL(slice.budgetedCents)})`}</title>
          </path>
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-stone-900 text-sm font-semibold"
        >
          {active ? `${active.percentage}%` : "Orçamento"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-stone-500 text-xs">
          {active
            ? formatCentsToBRL(active.budgetedCents)
            : `${slices.filter((s) => s.percentage > 0).length} classificações`}
        </text>
      </svg>

      <ul className="mt-1 flex flex-wrap items-start justify-center gap-x-3 gap-y-1.5">
        {slices.map((slice) => (
          <li
            key={slice.classification}
            className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs"
            onMouseEnter={() => setActive(slice)}
            onMouseLeave={() => setActive(null)}
          >
            <IconBadge
              icon={CLASSIFICATION_ICONS[slice.classification]}
              color={CLASSIFICATION_COLORS[slice.classification]}
              size="sm"
            />
            <div className="leading-tight">
              <p className="text-stone-700">{CLASSIFICATION_LABELS[slice.classification]}</p>
              <p className="font-medium text-stone-900">
                {slice.percentage}% · {formatCentsToBRL(slice.budgetedCents)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
