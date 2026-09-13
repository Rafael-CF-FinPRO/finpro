"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { describeDonutSegment } from "@/lib/donut-geometry";
import { PATRIMONIO_ASSET_CATEGORY_COLORS } from "@/lib/patrimonio-colors";
import type { CategoryComposition } from "@/lib/patrimonio";
import type { PatrimonioAssetCategory } from "@/generated/prisma/enums";

// Tipo/Localização only ever have 2 real values + "Não informado" — a
// small fixed palette is enough, unlike Categoria which has its own
// dedicated color per category (patrimonio-colors.ts).
const FALLBACK_PALETTE = ["var(--primary)", "var(--success)", "var(--text-faint)"];

function colorFor(view: "categoria" | "tipo" | "localizacao", category: string, index: number): string {
  if (view === "categoria") return PATRIMONIO_ASSET_CATEGORY_COLORS[category as PatrimonioAssetCategory];
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

/** "Composição dos Ativos" — a single donut with a 3-way view toggle
 * (Categoria / Tipo / Localização), same alternator pattern as
 * ValueDistributionDonut (Dashboard), so the 3 charts the spec asks for
 * (8.2, 8.6, 8.7) stay a single, clear component instead of 3 separate
 * donuts competing for space. */
export function AssetCompositionDonut({
  byCategory,
  byUsage,
  byLocation,
}: {
  byCategory: CategoryComposition[];
  byUsage: CategoryComposition[];
  byLocation: CategoryComposition[];
}) {
  const [view, setView] = useState<"categoria" | "tipo" | "localizacao">("categoria");
  const [active, setActive] = useState<string | null>(null);

  const data = view === "categoria" ? byCategory : view === "tipo" ? byUsage : byLocation;
  const total = data.reduce((sum, d) => sum + d.valueCents, 0);

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 92;
  const innerR = 56;

  const segments = data.reduce<{ item: CategoryComposition; color: string; startAngle: number; endAngle: number }[]>(
    (acc, item, index) => {
      const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const endAngle = startAngle + (item.valueCents / total) * 360;
      return [...acc, { item, color: colorFor(view, item.category, index), startAngle, endAngle }];
    },
    []
  );

  const activeSlice = segments.find((s) => s.item.category === active);
  const pctOf = (cents: number) => (total > 0 ? Math.round((cents / total) * 100) : 0);

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Composição dos Ativos</p>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
          {(["categoria", "tipo", "localizacao"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setActive(null);
              }}
              className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                view === v ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {v === "localizacao" ? "Localização" : v}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">Nenhum ativo cadastrado ainda.</p>
      ) : (
        <div className="mt-4 flex flex-col items-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Composição dos ativos">
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
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-[var(--text-primary)] text-sm font-semibold">
              {activeSlice ? `${pctOf(activeSlice.item.valueCents)}%` : "Total"}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[var(--muted)] text-xs">
              {activeSlice ? formatCentsToBRL(activeSlice.item.valueCents) : formatCentsToBRL(total)}
            </text>
          </svg>

          <ul className="mt-1 flex flex-wrap items-start justify-center gap-x-3 gap-y-1.5">
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
