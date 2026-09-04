"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CLASSIFICATION_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/transaction-labels";
import { withCategoryDisplayName } from "@/lib/category-display";
import type { TransactionFilters } from "@/lib/transactions";
import type { Classification } from "@/generated/prisma/enums";

type CategoryOption = {
  id: string;
  name: string;
  type: "ENTRADA" | "SAIDA" | "NEUTRO";
  classification: Classification;
};

export function FiltersBar({
  filters,
  categories,
}: {
  filters: TransactionFilters;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const visibleCategories = withCategoryDisplayName(
    filters.type === "all" ? categories : categories.filter((c) => c.type === filters.type)
  );

  return (
    <div className="card flex flex-wrap items-center gap-3 p-3">
      <select
        aria-label="Período"
        className="field-input w-auto py-2"
        value={filters.period}
        onChange={(e) =>
          updateParams({
            period: e.target.value,
            from: e.target.value === "custom" ? filters.from : undefined,
            to: e.target.value === "custom" ? filters.to : undefined,
          })
        }
      >
        <option value="current">Este mês</option>
        <option value="previous">Mês anterior</option>
        <option value="custom">Personalizado</option>
      </select>

      {filters.period === "custom" && (
        <>
          <input
            type="date"
            aria-label="De"
            className="field-input w-auto py-2"
            defaultValue={filters.from ?? ""}
            onChange={(e) => updateParams({ from: e.target.value })}
          />
          <input
            type="date"
            aria-label="Até"
            className="field-input w-auto py-2"
            defaultValue={filters.to ?? ""}
            onChange={(e) => updateParams({ to: e.target.value })}
          />
        </>
      )}

      <select
        aria-label="Tipo"
        className="field-input w-auto py-2"
        value={filters.type}
        onChange={(e) =>
          updateParams({ type: e.target.value, categoryId: undefined })
        }
      >
        <option value="all">Todos os tipos</option>
        <option value="ENTRADA">{TYPE_LABELS.ENTRADA}s</option>
        <option value="SAIDA">{TYPE_LABELS.SAIDA}s</option>
        <option value="NEUTRO">{TYPE_LABELS.NEUTRO}s</option>
      </select>

      <select
        aria-label="Categoria"
        className="field-input w-auto py-2"
        value={filters.categoryId ?? ""}
        onChange={(e) => updateParams({ categoryId: e.target.value })}
      >
        <option value="">Todas as categorias</option>
        {visibleCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.displayName}
          </option>
        ))}
      </select>

      <select
        aria-label="Classificação"
        className="field-input w-auto py-2"
        value={filters.classification}
        onChange={(e) => updateParams({ classification: e.target.value })}
      >
        <option value="all">Todas as classificações</option>
        {Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        aria-label="Status de pagamento"
        className="field-input w-auto py-2"
        value={filters.status}
        onChange={(e) => updateParams({ status: e.target.value })}
      >
        <option value="all">Pago e não pago</option>
        <option value="PAGO">{STATUS_LABELS.PAGO}</option>
        <option value="NAO_PAGO">{STATUS_LABELS.NAO_PAGO}</option>
      </select>
    </div>
  );
}
