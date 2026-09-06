"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCategoryDisplayName } from "@/lib/category-display";
import { IconBadge } from "@/components/orcamento/IconBadge";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

const RECEITAS_COLOR = "var(--primary)";

type Slice = {
  key: string;
  name: string;
  valueCents: number;
  color: string;
  icon: ReturnType<typeof getCategoryIcon>;
  variant: "solid" | "soft";
};

// Same donut geometry as BudgetPieChart/BudgetCategoryDistribution —
// duplicated deliberately rather than shared, since those stay exactly
// as they are; this is an independent chart with its own slice shape
// (it mixes Receitas in with the 3 classifications, which the Orçamento
// donuts never do).
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

/** "Distribuição dos Valores" — a donut that puts Receitas (all of this
 * month's income) alongside the 3 classifications' Realizado, so the
 * relationship between what came in and where it went reads at a
 * glance. Toggles to a per-category breakdown the same way Orçamento ×
 * Realizado does; Receitas stays a single slice in both views — only
 * the 3 classifications get replaced by their categories.
 * Investimentos (classification or category) is a destination for
 * money, never grouped with Custos Obrigatórios/Prazeres e Confortos as
 * if it were consumption — it's simply its own slice/color, same as
 * everywhere else in the app. Reads only from the BudgetOverview
 * already fetched by the Dashboard page (Realizado + realizedIncomeCents)
 * — no new data, no changes to the budget's own logic. */
export function ValueDistributionDonut({
  realizedIncomeCents,
  classifications,
}: {
  realizedIncomeCents: number;
  classifications: ClassificationBudgetRow[];
}) {
  const [view, setView] = useState<"classificacoes" | "categorias">("classificacoes");
  const [active, setActive] = useState<Slice | null>(null);

  const receitasSlice: Slice = {
    key: "receitas",
    name: "Receitas",
    valueCents: realizedIncomeCents,
    color: RECEITAS_COLOR,
    icon: Wallet,
    variant: "solid",
  };

  const classificationSlices: Slice[] = classifications.map((cls) => ({
    key: cls.classification,
    name: CLASSIFICATION_LABELS[cls.classification],
    valueCents: cls.realizedCents,
    color: CLASSIFICATION_COLORS[cls.classification as NonReceita],
    icon: CLASSIFICATION_ICONS[cls.classification as NonReceita],
    variant: "solid",
  }));

  const categorySlices: Slice[] = withCategoryDisplayName(
    classifications.flatMap((cls) =>
      cls.categories
        .filter((cat) => cat.realizedCents > 0)
        .map((cat) => ({ ...cat, classification: cls.classification }))
    )
  ).map((cat) => ({
    key: cat.categoryId,
    name: cat.displayName,
    valueCents: cat.realizedCents,
    color: CLASSIFICATION_COLORS[cat.classification as NonReceita],
    icon: getCategoryIcon(cat.name),
    variant: "soft",
  }));

  const slices = [receitasSlice, ...(view === "classificacoes" ? classificationSlices : categorySlices)];
  const total = slices.reduce((sum, s) => sum + s.valueCents, 0);

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 100;
  const innerR = 62;

  const segments = slices
    .filter((s) => s.valueCents > 0)
    .reduce<{ slice: Slice; startAngle: number; endAngle: number }[]>((acc, slice) => {
      const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
      const endAngle = startAngle + (slice.valueCents / total) * 360;
      return [...acc, { slice, startAngle, endAngle }];
    }, []);

  const pctOf = (cents: number) => (total > 0 ? Math.round((cents / total) * 100) : 0);

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-700">Distribuição dos Valores</p>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setView("classificacoes");
              setActive(null);
            }}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "classificacoes"
                ? "bg-[var(--primary)] text-white"
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            Classificações
          </button>
          <button
            type="button"
            onClick={() => {
              setView("categorias");
              setActive(null);
            }}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "categorias"
                ? "bg-[var(--primary)] text-white"
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Nenhum valor registrado neste mês.
        </p>
      ) : (
        <div className="mt-4 flex flex-col items-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label="Distribuição dos valores do mês"
          >
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
                onClick={() => setActive((prev) => (prev?.key === slice.key ? null : slice))}
              >
                <title>{`${slice.name}: ${formatCentsToBRL(slice.valueCents)} (${pctOf(slice.valueCents)}%)`}</title>
              </path>
            ))}
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-stone-900 text-sm font-semibold">
              {active ? `${pctOf(active.valueCents)}%` : "Total"}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-stone-500 text-xs">
              {active ? formatCentsToBRL(active.valueCents) : formatCentsToBRL(total)}
            </text>
          </svg>

          <ul className="mt-1 flex flex-wrap items-start justify-center gap-x-3 gap-y-1.5">
            {slices.map((slice) => (
              <li
                key={slice.key}
                className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs"
                onMouseEnter={() => setActive(slice)}
                onMouseLeave={() => setActive(null)}
              >
                <IconBadge icon={slice.icon} color={slice.color} variant={slice.variant} size="sm" />
                <div className="leading-tight">
                  <p className="text-stone-700">{slice.name}</p>
                  <p className="font-medium text-stone-900">
                    {pctOf(slice.valueCents)}% · {formatCentsToBRL(slice.valueCents)}
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
