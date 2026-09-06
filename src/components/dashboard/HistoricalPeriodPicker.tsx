"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { addMonthsClamped, parseDateInputValue, toDateInputValue } from "@/lib/dates";

const PRESETS = [
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "12 meses", months: 12 },
];

/** Today, as a "YYYY-MM-DD" value — computed the same way the server
 * side of this page does (see currentMonthKey in src/lib/dates.ts):
 * plain `new Date()` read through UTC getters. This only has to agree
 * with itself (comparing a preset's own `to` against `today` to decide
 * which button is active) so any timezone skew from the real calendar
 * day is harmless. */
function todayAsDateInputValue(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
}

function presetFromDate(months: number): string {
  const today = parseDateInputValue(todayAsDateInputValue())!;
  return toDateInputValue(addMonthsClamped(today, -months));
}

/** Which preset (if any) the given range is exactly equivalent to right
 * now — used both to highlight the matching button and to decide
 * whether the custom date inputs should already be open (a page load
 * or shared link landing on a genuine custom range shouldn't show 4
 * unhighlighted buttons with no visible dates). */
function matchedPresetLabel(from: string, to: string): string | undefined {
  const today = todayAsDateInputValue();
  if (to !== today) return undefined;
  return PRESETS.find((p) => from === presetFromDate(p.months))?.label;
}

/** "Visão Histórica"'s period picker — 3 quick presets (an exact rolling
 * date window ending today, not whole calendar months) plus a genuine
 * custom date range (any start date to any end date, not limited to
 * month boundaries) for "Personalizado". Every chart/average downstream
 * respects the exact dates chosen — see enumerateMonthBucketsForDateRange
 * in src/lib/dates.ts, which clips the first/last month to them. */
export function HistoricalPeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Open by default whenever the incoming range isn't one of the 3
  // presets — a page load, refresh, or shared link landing on a real
  // custom range should show that range's actual dates, not 4
  // unhighlighted buttons.
  const [customOpen, setCustomOpen] = useState(() => !matchedPresetLabel(from, to));
  const [isPending, startTransition] = useTransition();
  // Shown immediately on click, before the round trip that recomputes
  // `from`/`to` (and therefore activePreset) server-side finishes —
  // cleared once those props catch up to what was clicked (adjusting
  // state during render on a prop change, per React's own guidance,
  // rather than an effect that would cause an extra commit).
  const [prevRange, setPrevRange] = useState(`${from}|${to}`);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  if (`${from}|${to}` !== prevRange) {
    setPrevRange(`${from}|${to}`);
    setPendingLabel(null);
    setCustomOpen(!matchedPresetLabel(from, to));
  }

  function hrefFor(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    return `${pathname}?${params.toString()}`;
  }

  function apply(newFrom: string, newTo: string) {
    startTransition(() => {
      router.push(hrefFor(newFrom, newTo));
    });
  }

  function applyPreset(label: string, months: number) {
    const today = todayAsDateInputValue();
    setCustomOpen(false);
    setPendingLabel(label);
    apply(presetFromDate(months), today);
  }

  // The 3 presets are a small, known set — worth prefetching
  // unconditionally so a click resolves instantly.
  useEffect(() => {
    const today = todayAsDateInputValue();
    for (const preset of PRESETS) {
      router.prefetch(hrefFor(presetFromDate(preset.months), today));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const activeLabel = pendingLabel ?? (customOpen ? undefined : matchedPresetLabel(from, to));

  return (
    <div
      className={`card flex flex-wrap items-center gap-2 p-3 transition-opacity ${
        isPending ? "opacity-70" : ""
      }`}
    >
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => applyPreset(preset.label, preset.months)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            activeLabel === preset.label
              ? "bg-[var(--primary)] text-white"
              : "border border-[var(--surface-border)] text-stone-600 hover:bg-stone-50"
          }`}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCustomOpen((prev) => !prev)}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          customOpen
            ? "bg-[var(--primary)] text-white"
            : "border border-[var(--surface-border)] text-stone-600 hover:bg-stone-50"
        }`}
      >
        Personalizado
      </button>

      {customOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Data inicial"
            defaultValue={from}
            max={to}
            className="field-input w-auto py-1.5"
            onChange={(e) => e.target.value && apply(e.target.value, to)}
          />
          <span className="text-sm text-[var(--muted)]">até</span>
          <input
            type="date"
            aria-label="Data final"
            defaultValue={to}
            min={from}
            className="field-input w-auto py-1.5"
            onChange={(e) => e.target.value && apply(from, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
