"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { describeDonutSegment } from "@/lib/donut-geometry";
import { PATRIMONIO_LIABILITY_CATEGORY_COLORS } from "@/lib/patrimonio-colors";
import type { CategoryComposition } from "@/lib/patrimonio";
import type { PatrimonioLiabilityCategory } from "@/generated/prisma/enums";

/** "Composição dos Passivos" — one donut by category, no view toggle
 * needed (unlike AssetCompositionDonut) since the spec only asks for a
 * single breakdown here. Same donut skeleton as every other chart. */
export function LiabilityCompositionDonut({ byCategory }: { byCategory: CategoryComposition[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = byCategory.reduce((sum, d) => sum + d.valueCents, 0);

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 92;
  const innerR = 56;

  const segments = byCategory.reduce<{ item: CategoryComposition; startAngle: number; endAngle: number }[]>(
    (acc, item) => {
      const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const endAngle = startAngle + (item.valueCents / total) * 360;
      return [...acc, { item, startAngle, endAngle }];
    },
    []
  );

  const activeSlice = segments.find((s) => s.item.category === active);
  const pctOf = (cents: number) => (total > 0 ? Math.round((cents / total) * 100) : 0);

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-[var(--text-secondary)]">Composição dos Passivos</p>

      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">Nenhum passivo cadastrado ainda.</p>
      ) : (
        <div className="mt-4 flex flex-col items-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Composição dos passivos">
            {segments.map(({ item, startAngle, endAngle }) => {
              const color = PATRIMONIO_LIABILITY_CATEGORY_COLORS[item.category as PatrimonioLiabilityCategory];
              return (
                <path
                  key={item.category}
                  d={describeDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle)}
                  fill={color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  opacity={active && active !== item.category ? 0.4 : 1}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setActive(item.category)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => setActive((prev) => (prev === item.category ? null : item.category))}
                >
                  <title>{`${item.label}: ${formatCentsToBRL(item.valueCents)} (${pctOf(item.valueCents)}%)`}</title>
                </path>
              );
            })}
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-[var(--text-primary)] text-sm font-semibold">
              {activeSlice ? `${pctOf(activeSlice.item.valueCents)}%` : "Total"}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[var(--muted)] text-xs">
              {activeSlice ? formatCentsToBRL(activeSlice.item.valueCents) : formatCentsToBRL(total)}
            </text>
          </svg>

          <ul className="mt-1 flex flex-wrap items-start justify-center gap-x-3 gap-y-1.5">
            {segments.map(({ item }) => (
              <li
                key={item.category}
                className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs"
                onMouseEnter={() => setActive(item.category)}
                onMouseLeave={() => setActive(null)}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PATRIMONIO_LIABILITY_CATEGORY_COLORS[item.category as PatrimonioLiabilityCategory] }}
                />
                <div className="leading-tight">
                  <p className="text-[var(--text-secondary)]">{item.label}</p>
                  <p className="font-medium text-[var(--text-primary)]">
                    {pctOf(item.valueCents)}% · {formatCentsToBRL(item.valueCents)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
