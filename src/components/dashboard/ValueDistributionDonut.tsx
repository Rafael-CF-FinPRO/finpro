"use client";

import { useState } from "react";
import { formatCentsToBRL } from "@/lib/money";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { getCategoryIcon } from "@/lib/category-icons";
import { withCategoryDisplayName } from "@/lib/category-display";
import { IconBadge } from "@/components/orcamento/IconBadge";
import { describeDonutSegment } from "@/lib/donut-geometry";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

type Slice = {
  key: string;
  name: string;
  valueCents: number;
  color: string;
  icon: ReturnType<typeof getCategoryIcon>;
  variant: "solid" | "soft";
};

/** "Distribuição das Despesas" — a donut showing how this month's
 * expenses split across the 3 budget classifications (Custos
 * Obrigatórios, Prazeres e Confortos, Investimentos), or per-category
 * within them. Receitas plays no part here — this chart is exclusively
 * about where the money that left the account in the period went, so
 * the total always represents 100% of the period's expenses.
 * Investimentos (classification or category) is a destination for
 * money, never grouped with Custos Obrigatórios/Prazeres e Confortos as
 * if it were consumption — but it's still a realized outflow for the
 * period, so it keeps its own slice/color, same as everywhere else in
 * the app. Reads only from the BudgetOverview already fetched by the
 * Dashboard page (Realizado per classification) — no new data, no
 * changes to the budget's own logic. */
export function ValueDistributionDonut({
  classifications,
}: {
  classifications: ClassificationBudgetRow[];
}) {
  const [view, setView] = useState<"classificacoes" | "categorias">("classificacoes");
  const [active, setActive] = useState<Slice | null>(null);

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

  const slices = view === "classificacoes" ? classificationSlices : categorySlices;
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
        <p className="text-sm font-medium text-[var(--text-secondary)]">Distribuição das Despesas</p>
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setView("classificacoes");
              setActive(null);
            }}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              view === "classificacoes"
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
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
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Nenhuma despesa registrada neste mês.
        </p>
      ) : (
        <div className="mt-4 flex flex-col items-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label="Distribuição das despesas do mês"
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
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-[var(--text-primary)] text-sm font-semibold">
              {active ? `${pctOf(active.valueCents)}%` : "Total"}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-[var(--muted)] text-xs">
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
                  <p className="text-[var(--text-secondary)]">{slice.name}</p>
                  <p className="font-medium text-[var(--text-primary)]">
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
