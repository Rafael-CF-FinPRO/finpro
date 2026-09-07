"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { saveBudgetDistributionAction, removeMonthOverrideAction } from "@/app/actions/budget";
import {
  computeBudgetPct,
  computeBudgetStatus,
  computeGoalStatus,
  isGoalClassification,
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
import { StatusBadge } from "./StatusBadge";
import { IconBadge } from "./IconBadge";
import { CategoryAllocationEditor } from "./CategoryAllocationEditor";
import { BudgetPieChart } from "./BudgetPieChart";
import { BudgetCategoryDistribution } from "./BudgetCategoryDistribution";
import { BudgetHealthIndicators } from "./BudgetHealthIndicators";
import { ApplyScopeDialog } from "./ApplyScopeDialog";
import { RestoreDefaultDialog } from "./RestoreDefaultDialog";
import { IncomeCard } from "./IncomeCard";

type NonReceita = Exclude<Classification, "RECEITA" | "NEUTRA">;

// Remembers whether the charts are collapsed across visits — a
// per-browser UI preference, not user data, so localStorage is the
// right place for it (same pattern as the sidebar's own collapse state).
const CHARTS_COLLAPSE_KEY = "finpro:orcamento-charts-collapsed";

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

  // A Classification no longer has its own directly-editable percentage
  // — it's purely the sum of its own (active) Categories' percentages,
  // computed fresh from whatever's currently on the sliders. This one
  // function is the single source of that derivation, used for the
  // classification cards' display, the pie/donut charts, and the health
  // indicators alike — never a separately-tracked value that could
  // drift from the categories underneath it.
  function classificationTotalFor(classification: Classification): number {
    const cls = classifications.find((c) => c.classification === classification);
    const activeIds = (cls?.categories ?? []).filter((c) => c.isActive).map((c) => c.categoryId);
    return sumPercentages(activeIds.map((id) => pctByCategory[id] ?? 0));
  }

  // The only distribution total that matters now is the grand total
  // across every category, in every classification — 100% of income
  // split among named categories, full stop. A category sitting at 0%
  // is completely normal and never blocks this; only exceeding 100%
  // does.
  const allActiveCategoryIds = classifications.flatMap((cls) =>
    cls.categories.filter((c) => c.isActive).map((c) => c.categoryId)
  );
  const categoryGrandTotal = sumPercentages(allActiveCategoryIds.map((id) => pctByCategory[id] ?? 0));
  const isFullyDistributed = categoryGrandTotal === 100;
  const isOverDistributed = categoryGrandTotal > 100;
  const distributionRemaining = 100 - categoryGrandTotal;
  const canSave = !isOverDistributed;

  function enterEdit() {
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
        // The server recomputes and persists this same sum itself
        // (never trusts a client-submitted classification percentage) —
        // sent here only to keep the existing payload shape intact.
        classifications: classifications.map((c) => ({
          classification: c.classification,
          percentage: classificationTotalFor(c.classification),
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
    const percentage = mode === "edit" ? classificationTotalFor(c.classification) : c.percentage;
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
    if (mode === "edit") return classificationTotalFor(classification);
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
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Distribuição do orçamento</p>
                  <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDistributionView("classificacoes")}
                      className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                        distributionView === "classificacoes"
                          ? "bg-[var(--primary)] text-[var(--on-primary)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      Classificações
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistributionView("categorias")}
                      className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                        distributionView === "categorias"
                          ? "bg-[var(--primary)] text-[var(--on-primary)]"
                          : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
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
                <p className="mb-3 text-center text-sm font-medium text-[var(--text-secondary)] lg:text-left">
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
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] py-1.5 text-xs font-medium text-[var(--muted)] shadow-sm hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] ${
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
              <span className="font-medium text-[var(--text-secondary)]">{formatMonthKeyLabel(monthKey)}</span>{" "}
              tem uma personalização própria.
            </>
          ) : (
            <>
              <span className="font-medium text-[var(--text-secondary)]">{formatMonthKeyLabel(monthKey)}</span>{" "}
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
          const clsPct = classificationPercentage(cls.classification);
          const liveBudgeted = centsFromPercentage(monthlyIncomeCents, clsPct);
          const isGoal = isGoalClassification(cls.classification);
          const liveDiferenca = liveBudgeted - cls.realizedCents;
          const livePctGasto = computeBudgetPct(cls.realizedCents, liveBudgeted);
          const liveStatus = isGoal ? undefined : computeBudgetStatus(cls.realizedCents, liveBudgeted);
          const liveGoalStatus = isGoal ? computeGoalStatus(cls.realizedCents, liveBudgeted) : undefined;
          const isExpanded = Boolean(expanded[cls.classification]);
          const activeCategories = cls.categories.filter((c) => c.isActive);

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
                      <p className="font-semibold text-[var(--text-primary)]">
                        {CLASSIFICATION_LABELS[cls.classification]}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {CLASSIFICATION_DESCRIPTIONS[cls.classification]}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={liveStatus} goalStatus={liveGoalStatus} />
                </div>

                {/* No slider here anymore — a Classification's percentage
                    is purely the sum of its own Categories' percentages
                    (classificationTotalFor above), never a value the user
                    sets directly. */}
                <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                  {clsPct.toLocaleString("pt-BR")}%
                  {mode === "edit" && (
                    <span className="ml-1.5 font-normal text-[var(--text-faint)]">
                      · soma das categorias abaixo
                    </span>
                  )}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[var(--muted)]">{isGoal ? "Meta" : "Orçado"}</p>
                    <p className="font-medium text-[var(--text-primary)]">{formatCentsToBRL(liveBudgeted)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--muted)]">{isGoal ? "Investido" : "Realizado"}</p>
                    <p className="font-medium text-[var(--text-primary)]">
                      {formatCentsToBRL(cls.realizedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted)]">
                      {isGoal
                        ? liveGoalStatus === "META_ATINGIDA"
                          ? "Meta superada em"
                          : "Falta para a meta"
                        : "Diferença"}
                    </p>
                    <p
                      className={`font-medium ${
                        !isGoal && liveDiferenca < 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {formatCentsToBRL(isGoal ? Math.abs(liveDiferenca) : liveDiferenca)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--muted)]">{isGoal ? "% da meta" : "% Utilizado"}</p>
                    <p className="font-medium text-[var(--text-primary)]">
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
                  <div className="space-y-2 border-t border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4">
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
                            className="card border-l-4 p-2"
                            style={{ borderLeftColor: classificationColor }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-2">
                                <IconBadge
                                  icon={getCategoryIcon(cat.name)}
                                  color={classificationColor}
                                  variant="soft"
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[var(--text-primary)]">{cat.name}</p>
                                  {cat.description && (
                                    <p className="text-xs leading-snug text-[var(--text-tertiary)]">
                                      {cat.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isGoal ? (
                                <StatusBadge
                                  goalStatus={computeGoalStatus(cat.realizedCents, cat.budgetedCents)}
                                />
                              ) : (
                                <StatusBadge status={cat.status} />
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
                              <span>
                                {isGoal ? "Meta" : "Orçado"}{" "}
                                <span className="font-medium text-[var(--text-primary)]">
                                  {formatCentsToBRL(cat.budgetedCents)}
                                </span>
                              </span>
                              <span>
                                {isGoal ? "Investido" : "Realizado"}{" "}
                                <span className="font-medium text-[var(--text-primary)]">
                                  {formatCentsToBRL(cat.realizedCents)}
                                </span>
                              </span>
                              <span>
                                {isGoal ? "% da meta" : "% Utilizado"}{" "}
                                <span className="font-medium text-[var(--text-primary)]">
                                  {catPctGasto === null
                                    ? "—"
                                    : `${catPctGasto.toLocaleString("pt-BR")}%`}
                                </span>
                              </span>
                              {!cat.isConfigured && cat.percentage === 0 && <span>Não configurada</span>}
                            </div>
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
              isOverDistributed
                ? "text-[var(--danger)]"
                : isFullyDistributed
                  ? "text-[var(--success)]"
                  : "text-[var(--muted)]"
            }`}
          >
            {isOverDistributed
              ? `Distribuição excede 100% em ${Math.abs(distributionRemaining).toLocaleString("pt-BR")}%.`
              : isFullyDistributed
                ? `Total distribuído: ${categoryGrandTotal.toLocaleString("pt-BR")}%`
                : `Distribuição restante: ${distributionRemaining.toLocaleString("pt-BR")}%`}
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
