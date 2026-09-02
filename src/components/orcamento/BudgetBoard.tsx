"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBudgetDistributionAction, removeMonthOverrideAction } from "@/app/actions/budget";
import {
  computeBudgetPct,
  computeBudgetStatus,
  centsFromPercentage,
  sumPercentages,
} from "@/lib/budget-calc";
import { formatCentsToBRL } from "@/lib/money";
import { formatMonthKeyLabel } from "@/lib/dates";
import { CLASSIFICATION_LABELS } from "@/lib/transaction-labels";
import { CLASSIFICATION_COLORS } from "@/lib/classification-colors";
import type { ClassificationBudgetRow } from "@/lib/budget";
import type { Classification } from "@/generated/prisma/enums";
import { PercentageSlider } from "./PercentageSlider";
import { StatusBadge } from "./StatusBadge";
import { CategoryAllocationEditor } from "./CategoryAllocationEditor";
import { BudgetPieChart } from "./BudgetPieChart";
import { ApplyScopeDialog } from "./ApplyScopeDialog";
import { RestoreDefaultDialog } from "./RestoreDefaultDialog";

type NonReceita = Exclude<Classification, "RECEITA">;

function buildClassificationPctMap(classifications: ClassificationBudgetRow[]) {
  return Object.fromEntries(classifications.map((c) => [c.classification, c.percentage]));
}

function buildCategoryPctMap(classifications: ClassificationBudgetRow[]) {
  return Object.fromEntries(
    classifications.flatMap((c) => c.categories.map((cat) => [cat.categoryId, cat.percentage]))
  );
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

  const classificationTotal = sumPercentages(Object.values(pctByClassification));
  const isValidClassificationTotal = classificationTotal === 100;
  const distributionRemaining = 100 - classificationTotal;

  function categoryTotalFor(classification: Classification): number | null {
    const cls = classifications.find((c) => c.classification === classification);
    const activeIds = (cls?.categories ?? []).filter((c) => c.isActive).map((c) => c.categoryId);
    if (activeIds.length === 0) return null;
    return sumPercentages(activeIds.map((id) => pctByCategory[id] ?? 0));
  }

  const categoryTotalsValid = classifications.every((cls) => {
    const total = categoryTotalFor(cls.classification);
    return total === null || total === 100;
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

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="mb-3 text-sm font-medium text-stone-700">Distribuição do orçamento</p>
        <BudgetPieChart slices={pieSlices} />
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

      <div className="space-y-3">
        {classifications.map((cls) => {
          const clsPct =
            mode === "edit" ? pctByClassification[cls.classification] ?? 0 : cls.percentage;
          const liveBudgeted = centsFromPercentage(monthlyIncomeCents, clsPct);
          const liveDiferenca = liveBudgeted - cls.realizedCents;
          const livePctGasto = computeBudgetPct(cls.realizedCents, liveBudgeted);
          const liveStatus = computeBudgetStatus(cls.realizedCents, liveBudgeted);
          const isExpanded = Boolean(expanded[cls.classification]);
          const catTotal = categoryTotalFor(cls.classification);
          const activeCategories = cls.categories.filter((c) => c.isActive);

          return (
            <div key={cls.classification} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CLASSIFICATION_COLORS[cls.classification as NonReceita] }}
                    />
                    <p className="font-semibold text-stone-900">
                      {CLASSIFICATION_LABELS[cls.classification]}
                    </p>
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

                {mode === "edit" && catTotal !== null && (
                  <p
                    className={`mt-2 text-xs font-medium ${
                      catTotal === 100 ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}
                  >
                    Categorias: {catTotal}%{catTotal !== 100 && " — precisa totalizar 100%."}
                  </p>
                )}
              </div>

              {isExpanded &&
                (mode === "edit" ? (
                  <CategoryAllocationEditor
                    classification={cls.classification}
                    classificationBudgetedCents={liveBudgeted}
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
                        return (
                          <div key={cat.categoryId} className="card p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-stone-900">{cat.name}</p>
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
