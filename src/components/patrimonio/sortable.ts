import { PATRIMONIO_FIELD_TYPE } from "@/lib/patrimonio-fields";
import {
  PATRIMONIO_USAGE_LABELS,
  PATRIMONIO_LOCATION_LABELS,
  PATRIMONIO_LIQUIDITY_LABELS,
} from "@/lib/patrimonio-colors";

export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection } | null;
export type SortPrimitive = string | number | Date | null;

/** Click-to-sort cycle for one column: none -> asc -> desc -> none.
 * Clicking a different column always starts it fresh at asc. */
export function nextSortState(current: SortState, key: string): SortState {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

function compareRaw(a: NonNullable<SortPrimitive>, b: NonNullable<SortPrimitive>): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
}

/** Sorts a copy of `rows` by the primitive `getValue` extracts for the
 * active sort column — never mutates `rows` or anything the caller
 * passed in, and never touches the database's own stored order (this
 * is purely a render-time concern). A null/missing value always sorts
 * last regardless of direction (the common "blanks at the bottom"
 * spreadsheet convention), and ties fall back to the original index so
 * the sort is stable. No active sort state returns `rows` unchanged
 * (its natural, as-stored order). */
export function sortRows<T>(rows: T[], sortState: SortState, getValue: (row: T, key: string) => SortPrimitive): T[] {
  if (!sortState) return rows;
  const { key, direction } = sortState;
  return rows
    .map((row, index) => ({ row, value: getValue(row, key), index }))
    .sort((a, b) => {
      if (a.value == null && b.value == null) return a.index - b.index;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      const cmp = compareRaw(a.value, b.value);
      if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
      return a.index - b.index;
    })
    .map((w) => w.row);
}

/** The generic, PATRIMONIO_FIELD_TYPE-driven sortable primitive for a
 * plain (non-computed) column — text/select values sort by their
 * displayed label, money/percent/integer by their numeric value, dates
 * by time. Computed columns (Taxa de Correção Anual, Rendimento do
 * Aluguel, Custo de Crédito...) aren't covered here since their value
 * never lives directly on the entity — each table supplies its own
 * override for those keys instead of calling this. */
export function sortablePrimitive(key: string, value: unknown): SortPrimitive {
  if (value == null || value === "") return null;
  const type = PATRIMONIO_FIELD_TYPE[key];
  switch (type) {
    case "money":
    case "percent":
    case "integer":
      return Number(value);
    case "date":
      return value as Date;
    case "boolean":
      return value ? 1 : 0;
    case "usage":
      return PATRIMONIO_USAGE_LABELS[value as string] ?? String(value);
    case "location":
      return PATRIMONIO_LOCATION_LABELS[value as string] ?? String(value);
    case "liquidity":
      return PATRIMONIO_LIQUIDITY_LABELS[value as string] ?? String(value);
    default:
      return String(value);
  }
}
