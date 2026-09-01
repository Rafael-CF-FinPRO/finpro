/** Formats a Date already stored/loaded from the database (dates are
 * persisted at UTC noon, see parseDateInputValue) back into a
 * "YYYY-MM-DD" input value. Uses UTC getters to match that convention. */
export function toDateInputValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's date in the *browser's* local timezone, as a "YYYY-MM-DD"
 * input value. Only call this client-side (e.g. to default a new
 * transaction's date field) — on the server "today" would be the
 * server's timezone, not the user's. */
export function todayLocalDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateBR(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Parses a "YYYY-MM-DD" input value into a Date at UTC noon, avoiding
 * local-timezone rollovers when the value is later formatted or stored. */
export function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12)
  );
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export type MonthRange = { from: Date; to: Date };

function monthRange(yearOffsetMonths: number): MonthRange {
  const now = new Date();
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + yearOffsetMonths, 1)
  );
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + yearOffsetMonths + 1, 1)
  );
  return { from, to };
}

export function currentMonthRange(): MonthRange {
  return monthRange(0);
}

export function previousMonthRange(): MonthRange {
  return monthRange(-1);
}
