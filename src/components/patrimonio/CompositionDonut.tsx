"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { describeDonutSegment } from "@/lib/donut-geometry";
import type { CategoryComposition } from "@/lib/patrimonio";

/** One donut, always showing exactly one breakdown — no view-toggle.
 * Reused 5 times in PatrimonioBoard (Ativos by Categoria/Tipo/
 * Localização/Liquidez, Passivos by Categoria) per the spec's explicit
 * "visualizações separadas, e não apenas em um único gráfico com
 * alternâncias pouco evidentes." `colorFor` is supplied by the caller so
 * this component stays entirely agnostic of what the categories mean —
 * a real enum with its own dedicated palette for Categoria, a small
 * fixed palette for the others. */
export function CompositionDonut({
  title,
  data,
  colorFor,
  emptyMessage,
}: {
  title: string;
  data: CategoryComposition[];
  colorFor: (category: string, index: number) => string;
  emptyMessage: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = data.reduce((sum, d) => sum + d.valueCents, 0);

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerR = 48;

  const segments = data.reduce<{ item: CategoryComposition; color: string; startAngle: number; endAngle: number }[]>(
    (acc, item, index) => {
      const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const endAngle = startAngle + (item.valueCents / total) * 360;
      return [...acc, { item, color: colorFor(item.category, index), startAngle, endAngle }];
    },
    []
  );

  const activeSlice = segments.find((s) => s.item.category === active);
  const pctOf = (cents: number) => (total > 0 ? Math.round((cents / total) * 100) : 0);

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>

      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">{emptyMessage}</p>
      ) : (
        <div className="mt-3 flex flex-col items-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
            {segments.map(({ item, color, startAngle, endAngle }) => (
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
            ))}
            <text x={cx} y={cy - 5} textAnchor="middle" className="fill-[var(--text-primary)] text-sm font-semibold">
              {activeSlice ? `${pctOf(activeSlice.item.valueCents)}%` : "Total"}
            </text>
            <text x={cx} y={cy + 13} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
              {activeSlice ? formatCentsToBRL(activeSlice.item.valueCents) : formatCentsToBRL(total)}
            </text>
          </svg>

          <ul className="mt-1 flex flex-wrap items-start justify-center gap-x-3 gap-y-1">
            {segments.map(({ item, color }) => (
              <li
                key={item.category}
                className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs"
                onMouseEnter={() => setActive(item.category)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
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
