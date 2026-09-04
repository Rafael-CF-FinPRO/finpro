"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { saveBudgetDistributionAction, removeMonthOverrideAction } from "@/app/actions/budget";
import {
  computeBudgetPct,
  computeBudgetStatus,
  centsFromPercentage,
  sumPercentages,
} from "@/lib/budget-calc";
import { formatCentsToBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { CLASSIFICATION_LABELS, CLASSIFICATION_DESCRIPTIONS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import { CLASSIFICATION_ICONS } from "@/lib/classification-icons";
import { getCategoryIcon } from "@/lib/category-icons";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";
import { PercentageSlider } from "./PercentageSlider";
import { StatusBadge } from "./StatusBadge";
import { IconBadge } from "./IconBadge";
import { CategoryAllocationEditor } from "./CategoryAllocationEditor";
import { BudgetPieChart } from "./BudgetPieChart";
import { BudgetCategoryDistribution } from "./BudgetCategoryDistribution";
import { BudgetHealthIndicators } from "./BudgetHealthIndicators";
import { ApplyScopeDialog } from "./ApplyScopeDialog";
import { RestoreDefaultDialog } from "./RestoreDefaultDialog";
import { IncomeCard } from "./IncomeCard";

type NonReceita = Exclude<Classification, "RECEITA">;

// Remembers whether the charts are collapsed across visits — a
// per-browser UI preference, not user data, so localStorage is the
// right place for it (same pattern as the sidebar's own collapse state).
const CHARTS_COLLAPSE_KEY = "finpro:orcamento-charts-collapsed";

function buildClassificationPctMap(classifications: ClassificationBudgetRow[]) {
  return Object.fromEntries(classifications.map((c) => [c.classification, c.percentage]));
}

function buildCategoryPctMap(classifications: ClassificationBudgetRow[]) {
  return Object.fromEntries(
    classifications.flatMap((c) => c.categories.map((cat) => [cat.categoryId, cat.percentage]))
  );
}

// Looks a category up by its exact canonical name across every
// classification (Seguros and Financiamentos e Compromissos
// Financeiros both live under Custos Obrigatórios today, but this
// doesn't assume that) — returns 0 if the user renamed or doesn't have
// it, rather than throwing.
function findCategoryPercentage(
  classifications: ClassificationBudgetRow[],
  categoryName: string,
  pctByCategory: Record<string, number>,
  mode: "view" | "edit"
): number {
  for (const cls of classifications) {
    const category = cls.categories.find((c) => c.name === categoryName);
    if (category) {
      return mode === "edit" ? pctByCategory[category.categoryId] ?? 0 : category.percentage;
    }
  }
  return 0;
}

export function BudgetBoard({
  monthKey,
  monthlyIncomeCents,
  isCustomMonth,
  classifications,
}: {
  monthKey: string;
  monthlyIncomeCents: number;
  isCustomMonth: boolean;
  classifications: ClassificationBudgetRow[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [pctByClassification, setPctByClassification] = useState<Record<string, number>>(() =>
    buildClassificationPctMap(classifications)
  );
  const [pctByCategory, setPctByCategory] = useState<Record<string, number>>(() =>
    buildCategoryPctMap(classifications)
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removing, startRemoveTransition] = useTransition();
  const [showApplyScope, setShowApplyScope] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [chartsCollapsed, setChartsCollapsed] = useState(false);
  const [distributionView, setDistributionView] = useState<"classificacoes" | "categorias">(
    "classificacoes"
  );

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body, to
    // avoid cascading renders during mount.
    const timeout = setTimeout(() => {
      try {
        setChartsCollapsed(localStorage.getItem(CHARTS_COLLAPSE_KEY) === "1");
      } catch {
        // localStorage unavailable (private mode, etc.) — default to expanded.
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  function toggleChartsCollapsed() {
    setChartsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CHARTS_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — the toggle still works for this session either way.
      }
      return next;
    });
  }

  const classificationTotal = sumPercentages(Object.values(pctByClassification));
  const isValidClassificationTotal = classificationTotal === 100;
  const distributionRemaining = 100 - classificationTotal;

  // Every Category's percentage is a direct share of total income, so a
  // Classification's own percentage is only ever a ceiling for the sum
  // of its Categories, never a total they must exactly hit — under-
  // distributing is fine (nothing forces every point of a
  // classification's budget onto a named category), only exceeding it
  // is invalid.
  function categoryTotalFor(classification: Classification): number {
    const cls = classifications.find((c) => c.classification === classification);
    const activeIds = (cls?.categories ?? []).filter((c) => c.isActive).map((c) => c.categoryId);
    return sumPercentages(activeIds.map((id) => pctByCategory[id] ?? 0));
  }

  const categoryTotalsValid = classifications.every((cls) => {
    const distributed = categoryTotalFor(cls.classification);
    const meta = pctByClassification[cls.classification] ?? 0;
    return distributed <= meta;
  });

  const canSave = isValidClassificationTotal && categoryTotalsValid;

  function enterEdit() {
    setPctByClassification(buildClassificationPctMap(classifications));
    setPctByCategory(buildCategoryPctMap(classifications));
    setError(null);
    setMode("edit");
  }

  function cancelEdit() {
    setMode("view");
    setError(null);
  }

  function handleSaveClick() {
    setError(null);
    if (!canSave) return;
    setShowApplyScope(true);
  }

  function submitDistribution(applyScope: "month" | "default") {
    setShowApplyScope(false);
    setError(null);
    startTransition(async () => {
      const categoriesPayload = classifications.flatMap((cls) =>
        cls.categories
          .filter((cat) => cat.isActive)
          .map((cat) => ({
            categoryId: cat.categoryId,
            percentage: pctByCategory[cat.categoryId] ?? 0,
          }))
      );
      const result = await saveBudgetDistributionAction({
        applyScope,
        monthKey,
        classifications: classifications.map((c) => ({
          classification: c.classification,
          percentage: pctByClassification[c.classification] ?? 0,
        })),
        categories: categoriesPayload,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setMode("view");
        router.refresh();
      }
    });
  }

  function confirmRestore() {
    setError(null);
    startRemoveTransition(async () => {
      const result = await removeMonthOverrideAction({ monthKey });
      setShowRestoreConfirm(false);
      if (result.error) {
        setError(result.error);
      } else {
        setMode("view");
        router.refresh();
      }
    });
  }

  const pieSlices = classifications.map((c) => {
    const percentage = mode === "edit" ? pctByClassification[c.classification] ?? 0 : c.percentage;
    return {
      classification: c.classification as NonReceita,
      percentage,
      budgetedCents:
        mode === "edit" ? centsFromPercentage(monthlyIncomeCents, percentage) : c.budgetedCents,
    };
  });

  // Same "Distribuição do orçamento" data as pieSlices, one row per
  // Category instead of per Classification — the alternate view
  // toggled in the same panel.
  const categorySlices = classifications.flatMap((cls) =>
    cls.categories
      .filter((cat) => cat.isActive)
      .map((cat) => {
        const percentage = mode === "edit" ? pctByCategory[cat.categoryId] ?? 0 : cat.percentage;
        return {
          categoryId: cat.categoryId,
          name: cat.name,
          classification: cls.classification as NonReceita,
          percentage,
          budgetedCents:
            mode === "edit" ? centsFromPercentage(monthlyIncomeCents, percentage) : cat.budgetedCents,
        };
      })
  );

  function classificationPercentage(classification: Classification): number {
    if (mode === "edit") return pctByClassification[classification] ?? 0;
    return classifications.find((c) => c.classification === classification)?.percentage ?? 0;
  }

  const custosObrigatoriosPct = classificationPercentage("CUSTOS_OBRIGATORIOS");
  const prazeresConfortosPct = classificationPercentage("PRAZERES_E_CONFORTOS");
  const investimentosPct = classificationPercentage("INVESTIMENTOS");
  const segurosPct = findCategoryPercentage(classifications, "Seguros", pctByCategory, mode);
  const dividasPct = findCategoryPercentage(
    classifications,
    "Financiamentos e Compromissos Financeiros",
    pctByCategory,
    mode
  );

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-20 sm:top-4">
        {!chartsCollapsed && (
          <div className="card p-4 shadow-md">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-stone-700">Distribuição do orçamento</p>
                  <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDistributionView("classificacoes")}
                      className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                        distributionView === "classificacoes"
                          ? "bg-[var(--primary)] text-white"
                          : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Classificações
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistributionView("categorias")}
                      className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                        distributionView === "categorias"
                          ? "bg-[var(--primary)] text-white"
                          : "text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      Categorias
                    </button>
                  </div>
                </div>
                {distributionView === "classificacoes" ? (
                  <BudgetPieChart slices={pieSlices} />
                ) : (
                  <BudgetCategoryDistribution categories={categorySlices} />
                )}
              </div>
              <div className="lg:border-l lg:border-[var(--surface-border)] lg:pl-6">
                <p className="mb-3 text-center text-sm font-medium text-stone-700 lg:text-left">
                  Indicadores de Saúde Orçamentária
                </p>
                <BudgetHealthIndicators
                  values={{
                    despesasEssenciais: custosObrigatoriosPct,
                    naoEssenciais: prazeresConfortosPct,
                    seguros: segurosPct,
                    dividas: dividasPct,
                    despesasVsReceita: custosObrigatoriosPct + prazeresConfortosPct,
                    investida: investimentosPct,
                  }}
                />
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleChartsCollapsed}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] py-1.5 text-xs font-medium text-stone-500 shadow-sm hover:bg-stone-50 hover:text-stone-700 ${
            chartsCollapsed ? "" : "mt-2"
          }`}
        >
          {chartsCollapsed ? (
            <>
              Mostrar gráficos <ChevronDown size={14} />
            </>
          ) : (
            <>
              Ocultar gráficos <ChevronUp size={14} />
            </>
          )}
        </button>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-[var(--muted)]">
          {isCustomMonth ? (
            <>
              <span className="font-medium text-stone-700">{formatMonthKeyLabel(monthKey)}</span>{" "}
              tem uma personalização própria.
            </>
          ) : (
            <>
              <span className="font-medium text-stone-700">{formatMonthKeyLabel(monthKey)}</span>{" "}
              segue o orçamento padrão.
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {isCustomMonth && (
            <button
              type="button"
              onClick={() => setShowRestoreConfirm(true)}
              disabled={removing}
              className="btn-secondary"
            >
              {removing ? "Restaurando..." : "Restaurar orçamento padrão"}
            </button>
          )}
          {mode === "view" ? (
            <button type="button" onClick={enterEdit} className="btn-primary">
              Personalizar orçamento
            </button>
          ) : (
            <button type="button" onClick={cancelEdit} className="btn-secondary" disabled={pending}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* BudgetBoard only ever renders once a BudgetProfile already
          exists (page.tsx gates it behind overview.hasProfile), so the
          card is always in its "already set" display state here — the
          onboarding/first-time form lives on the page itself instead. */}
      <IncomeCard monthlyIncomeCents={monthlyIncomeCents} hasProfile />

      <div className="space-y-3">
        {classifications.map((cls) => {
          const clsPct =
            mode === "edit" ? pctByClassification[cls.classification] ?? 0 : cls.percentage;
          const liveBudgeted = centsFromPercentage(monthlyIncomeCents, clsPct);
          const liveDiferenca = liveBudgeted - cls.realizedCents;
          const livePctGasto = computeBudgetPct(cls.realizedCents, liveBudgeted);
          const liveStatus = computeBudgetStatus(cls.realizedCents, liveBudgeted);
          const isExpanded = Boolean(expanded[cls.classification]);
          const activeCategories = cls.categories.filter((c) => c.isActive);
          const distributed =
            mode === "edit"
              ? categoryTotalFor(cls.classification)
              : activeCategories.reduce((sum, c) => sum + c.percentage, 0);
          const isOverDistributed = distributed > clsPct;

          return (
            <div key={cls.classification} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <IconBadge
                      icon={CLASSIFICATION_ICONS[cls.classification as NonReceita]}
                      color={CLASSIFICATION_COLORS[cls.classification as NonReceita]}
                    />
                    <div>
                      <p className="font-semibold text-stone-900">
                        {CLASSIFICATION_LABELS[cls.classification]}
                      </p>
                      <p className="text-xs text-stone-600">
                        {CLASSIFICATION_DESCRIPTIONS[cls.classification]}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={liveStatus} />
                </div>

                {mode === "edit" ? (
                  <div className="mt-3">
                    <PercentageSlider
                      label={CLASSIFICATION_LABELS[cls.classification]}
                      value={clsPct}
                      onChange={(v) =>
                        setPctByClassification((prev) => ({ ...prev, [cls.classification]: v }))
                      }
                      monthlyIncomeCents={monthlyIncomeCents}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-medium text-stone-700">{clsPct}%</p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[var(--muted)]">Orçado</p>
                    <p className="font-medium text-stone-900">{formatCentsToBRL(liveBudgeted)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--muted)]">Realizado</p>
                    <p className="font-medium text-stone-900">
                      {formatCentsToBRL(cls.realizedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted)]">Diferença</p>
                    <p
                      className={`font-medium ${
                        liveDiferenca < 0 ? "text-[var(--danger)]" : "text-stone-900"
                      }`}
                    >
                      {formatCentsToBRL(liveDiferenca)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted)]">% Utilizado</p>
                    <p className="font-medium text-stone-900">
                      {livePctGasto === null ? "—" : `${livePctGasto.toLocaleString("pt-BR")}%`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [cls.classification]: !prev[cls.classification],
                    }))
                  }
                  className="mt-3 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)]"
                >
                  {isExpanded ? "Ocultar categorias ▲" : "Ver categorias ▼"}
                </button>

                <div className="mt-2 text-xs">
                  {isOverDistributed && (
                    <p className="font-medium text-[var(--danger)]">
                      As categorias de {CLASSIFICATION_LABELS[cls.classification]} ultrapassam o
                      orçamento definido para esta classificação.
                    </p>
                  )}
                  <p
                    className={
                      isOverDistributed
                        ? "font-medium text-[var(--danger)]"
                        : "text-[var(--muted)]"
                    }
                  >
                    Meta: {clsPct}% · Distribuído: {distributed}%
                    {isOverDistributed
                      ? ` · Excedente: ${distributed - clsPct}%`
                      : ` · Não distribuído: ${clsPct - distributed}%`}
                  </p>
                </div>
              </div>

              {isExpanded &&
                (mode === "edit" ? (
                  <CategoryAllocationEditor
                    classification={cls.classification}
                    monthlyIncomeCents={monthlyIncomeCents}
                    categories={cls.categories}
                    pct={pctByCategory}
                    onPctChange={(categoryId, value) =>
                      setPctByCategory((prev) => ({ ...prev, [categoryId]: value }))
                    }
                  />
                ) : (
                  <div className="space-y-2 border-t border-[var(--surface-border)] bg-stone-50/60 p-4">
                    {activeCategories.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">
                        Nenhuma categoria ativa nesta classificação.
                      </p>
                    ) : (
                      activeCategories.map((cat) => {
                        const catPctGasto = computeBudgetPct(cat.realizedCents, cat.budgetedCents);
                        const classificationColor =
                          CLASSIFICATION_COLORS[cls.classification as NonReceita];
                        return (
                          <div
                            key={cat.categoryId}
                            className="card border-l-4 p-3"
                            style={{ borderLeftColor: classificationColor }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <IconBadge
                                  icon={getCategoryIcon(cat.name)}
                                  color={classificationColor}
                                  variant="soft"
                                  size="sm"
                                />
                                <div>
                                  <p className="font-medium text-stone-900">{cat.name}</p>
                                  {cat.description && (
                                    <p className="text-xs text-stone-600">{cat.description}</p>
                                  )}
                                </div>
                              </div>
                              <StatusBadge status={cat.status} />
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <p className="text-[var(--muted)]">Orçado</p>
                                <p className="font-medium text-stone-900">
                                  {formatCentsToBRL(cat.budgetedCents)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[var(--muted)]">Realizado</p>
                                <p className="font-medium text-stone-900">
                                  {formatCentsToBRL(cat.realizedCents)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[var(--muted)]">% Utilizado</p>
                                <p className="font-medium text-stone-900">
                                  {catPctGasto === null
                                    ? "—"
                                    : `${catPctGasto.toLocaleString("pt-BR")}%`}
                                </p>
                              </div>
                            </div>
                            {!cat.isConfigured && cat.percentage === 0 && (
                              <p className="mt-1.5 text-xs text-[var(--muted)]">Não configurada</p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {mode === "edit" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p
            className={`text-sm font-medium ${
              isValidClassificationTotal ? "text-[var(--success)]" : "text-[var(--danger)]"
            }`}
          >
            {isValidClassificationTotal
              ? `Total distribuído: ${classificationTotal}%`
              : distributionRemaining > 0
                ? `Distribuição restante: ${distributionRemaining}%`
                : `Distribuição excede o limite em ${Math.abs(distributionRemaining)}%.`}
          </p>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={!canSave || pending}
            className="btn-primary"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      {error && <p className="alert-error">{error}</p>}

      {showApplyScope && (
        <ApplyScopeDialog
          monthKey={monthKey}
          pending={pending}
          onCancel={() => setShowApplyScope(false)}
          onChoose={submitDistribution}
        />
      )}

      {showRestoreConfirm && (
        <RestoreDefaultDialog
          pending={removing}
          onCancel={() => setShowRestoreConfirm(false)}
          onConfirm={confirmRestore}
        />
      )}
    </div>
  );
}
