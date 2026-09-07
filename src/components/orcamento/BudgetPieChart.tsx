"use client";

import { useState } from "react";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { formatCentsToBRL } from "@/lib/money";
import { IconBadge } from "./IconBadge";
import { describeDonutSegment } from "@/lib/donut-geometry";
import type { Classification } from "@/generated/prisma/enums";

type Slice = {
  classification: Exclude<Classification, "RECEITA" | "NEUTRA">;
  percentage: number;
  budgetedCents: number;
};

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
            <title>{`${CLASSIFICATION_LABELS[slice.classification]}: ${slice.percentage.toLocaleString("pt-BR")}% (${formatCentsToBRL(slice.budgetedCents)})`}</title>
          </path>
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-[var(--text-primary)] text-sm font-semibold"
        >
          {active ? `${active.percentage.toLocaleString("pt-BR")}%` : "Orçamento"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[var(--muted)] text-xs">
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
              <p className="text-[var(--text-secondary)]">{CLASSIFICATION_LABELS[slice.classification]}</p>
              <p className="font-medium text-[var(--text-primary)]">
                {slice.percentage.toLocaleString("pt-BR")}% · {formatCentsToBRL(slice.budgetedCents)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
