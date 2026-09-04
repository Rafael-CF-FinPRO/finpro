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

/** Adds `months` whole months to a UTC date, clamping the day to the
 * last valid day of the target month (e.g. 31/01 + 1 month -> 28 or
 * 29/02, never rolling over into March). Used to step recurring and
 * installment occurrence dates — see src/lib/series.ts. */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetMonthIndex = month + months;
  const daysInTargetMonth = new Date(
    Date.UTC(year, targetMonthIndex + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return new Date(Date.UTC(year, targetMonthIndex, clampedDay, 12));
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

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

/** The current calendar month as a "YYYY-MM" key, in UTC (matches how
 * all budget/transaction dates are stored and reasoned about). */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value: string): boolean {
  if (!MONTH_KEY_PATTERN.test(value)) return false;
  const [, , month] = MONTH_KEY_PATTERN.exec(value)!;
  const m = Number(month);
  return m >= 1 && m <= 12;
}

/** The [from, to) UTC date range covered by a "YYYY-MM" month key. */
export function monthRangeForKey(monthKey: string): MonthRange {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) throw new Error(`Invalid month key: ${monthKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return {
    from: new Date(Date.UTC(year, month, 1)),
    to: new Date(Date.UTC(year, month + 1, 1)),
  };
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) throw new Error(`Invalid month key: ${monthKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const shifted = new Date(Date.UTC(year, month + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "YYYY-MM" -> "Setembro 2026" */
export function formatMonthKeyLabel(monthKey: string): string {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return `${MONTH_LABELS[month]} ${year}`;
}

const MONTH_LABELS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** "YYYY-MM" -> "Set/26" — compact label for the history evolution chart,
 * where many months need to fit side by side. */
export function formatMonthKeyShortLabel(monthKey: string): string {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return `${MONTH_LABELS_SHORT[month]}/${String(year).slice(-2)}`;
}

/** Every "YYYY-MM" key from `fromMonthKey` to `toMonthKey`, inclusive,
 * in chronological order. Swaps the two if given in reverse. Clamped to
 * 24 months so a mistyped or manipulated URL can't trigger an
 * unbounded number of budget-overview queries. */
export function enumerateMonthKeys(fromMonthKey: string, toMonthKey: string): string[] {
  let from = fromMonthKey;
  let to = toMonthKey;
  if (from > to) {
    [from, to] = [to, from];
  }

  const keys: string[] = [];
  let cursor = from;
  const MAX_MONTHS = 24;
  while (cursor <= to && keys.length < MAX_MONTHS) {
    keys.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return keys;
}
