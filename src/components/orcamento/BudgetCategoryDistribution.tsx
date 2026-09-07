"use client";

import { useState } from "react";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { formatCentsToBRL } from "@/lib/money";
import { getCategoryIcon } from "@/lib/category-icons";
import { IconBadge } from "./IconBadge";
import { describeDonutSegment } from "@/lib/donut-geometry";
import type { Classification } from "@/generated/prisma/enums";

export type CategorySlice = {
  categoryId: string;
  name: string;
  classification: Exclude<Classification, "RECEITA" | "NEUTRA">;
  percentage: number;
  budgetedCents: number;
};

/** Alternate view of "Distribuição do orçamento" — one slice per
 * Category (Orçado %) instead of one per Classification, colored by
 * each category's own Classification so it reads as that same donut
 * subdivided. Only categories with a configured percentage (> 0) are
 * shown, same convention as the classification chart's own slice
 * filtering. */
export function BudgetCategoryDistribution({ categories }: { categories: CategorySlice[] }) {
  const [active, setActive] = useState<CategorySlice | null>(null);

  const configured = categories.filter((c) => c.percentage > 0);
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 100;
  const innerR = 62;

  const segments = configured.reduce<
    { slice: CategorySlice; startAngle: number; endAngle: number }[]
  >((acc, slice) => {
    const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
    const endAngle = startAngle + (slice.percentage / 100) * 360;
    return [...acc, { slice, startAngle, endAngle }];
  }, []);

  if (configured.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[var(--muted)]">
        Configure a distribuição das categorias para ver o gráfico.
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
        aria-label="Distribuição do orçamento entre categorias"
      >
        {segments.map(({ slice, startAngle, endAngle }) => (
          <path
            key={slice.categoryId}
            d={describeDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle)}
            fill={CLASSIFICATION_COLORS[slice.classification]}
            stroke="var(--surface)"
            strokeWidth={2}
            opacity={active && active.categoryId !== slice.categoryId ? 0.4 : 1}
            className="cursor-pointer transition-opacity"
            onMouseEnter={() => setActive(slice)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive((prev) => (prev?.categoryId === slice.categoryId ? null : slice))}
          >
            <title>{`${slice.name}: ${slice.percentage.toLocaleString("pt-BR")}% (${formatCentsToBRL(slice.budgetedCents)})`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-[var(--text-primary)] text-sm font-semibold">
          {active ? `${active.percentage.toLocaleString("pt-BR")}%` : "Orçamento"}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[var(--muted)] text-xs">
          {active ? formatCentsToBRL(active.budgetedCents) : `${configured.length} categorias`}
        </text>
      </svg>

      <ul className="mt-1 flex flex-wrap items-start justify-center gap-x-3 gap-y-1.5">
        {configured.map((slice) => (
          <li
            key={slice.categoryId}
            className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs"
            onMouseEnter={() => setActive(slice)}
            onMouseLeave={() => setActive(null)}
          >
            <IconBadge
              icon={getCategoryIcon(slice.name)}
              color={CLASSIFICATION_COLORS[slice.classification]}
              variant="soft"
              size="sm"
            />
            <div className="leading-tight">
              <p className="text-[var(--text-secondary)]">{slice.name}</p>
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
