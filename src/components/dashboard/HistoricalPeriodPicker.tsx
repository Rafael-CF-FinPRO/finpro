"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { currentMonthKey, shiftMonthKey } from "@/lib/dates";

const PRESETS = [
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "12 meses", months: 12 },
];

export function HistoricalPeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customOpen, setCustomOpen] = useState(false);
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
    const nowKey = currentMonthKey();
    const presetFrom = shiftMonthKey(nowKey, -(months - 1));
    setCustomOpen(false);
    setPendingLabel(label);
    apply(presetFrom, nowKey);
  }

  // The 3 presets are a small, known set — worth prefetching
  // unconditionally so a click resolves instantly.
  useEffect(() => {
    const nowKey = currentMonthKey();
    for (const preset of PRESETS) {
      router.prefetch(hrefFor(shiftMonthKey(nowKey, -(preset.months - 1)), nowKey));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  const nowKey = currentMonthKey();
  const resolvedPreset =
    to === nowKey
      ? PRESETS.find((p) => from === shiftMonthKey(nowKey, -(p.months - 1)))
      : undefined;
  const activeLabel = pendingLabel ?? (customOpen ? undefined : resolvedPreset?.label);

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
            type="month"
            aria-label="De"
            defaultValue={from}
            className="field-input w-auto py-1.5"
            onChange={(e) => e.target.value && apply(e.target.value, to)}
          />
          <span className="text-sm text-[var(--muted)]">até</span>
          <input
            type="month"
            aria-label="Até"
            defaultValue={to}
            className="field-input w-auto py-1.5"
            onChange={(e) => e.target.value && apply(from, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
