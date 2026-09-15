"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortState } from "./sortable";

/** One `<th>` for a Cadastros Gerais table — sortable by default (a
 * discreet chevron, dim when this column isn't the active sort, solid
 * up/down once it is), or a plain header when `sortable={false}` (used
 * for "Ações" and any other non-data column). Click cycles none -> asc
 * -> desc -> none (src/components/patrimonio/sortable.ts's
 * nextSortState) — purely a render-order concern, the stored/DB order
 * is never touched. */
export function SortableTh({
  label,
  sortKey,
  sortState,
  onSort,
  align = "center",
  tooltip,
  sortable = true,
}: {
  label: React.ReactNode;
  sortKey: string;
  sortState: SortState;
  onSort: (key: string) => void;
  align?: "left" | "center";
  tooltip?: string;
  sortable?: boolean;
}) {
  const alignClass = align === "left" ? "text-left" : "text-center";
  if (!sortable) {
    return (
      <th className={`px-3 py-2 ${alignClass}`} title={tooltip}>
        {label}
      </th>
    );
  }
  const active = sortState?.key === sortKey;
  const direction = active ? sortState!.direction : null;
  return (
    <th className={`px-3 py-2 ${alignClass}`} title={tooltip}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-[var(--text-primary)] ${
          active ? "text-[var(--text-primary)]" : ""
        }`}
      >
        {label}
        {direction === "asc" ? (
          <ChevronUp size={12} className="shrink-0" />
        ) : direction === "desc" ? (
          <ChevronDown size={12} className="shrink-0" />
        ) : (
          <ChevronsUpDown size={12} className="shrink-0 opacity-40" />
        )}
      </button>
    </th>
  );
}
