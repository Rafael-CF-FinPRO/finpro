"use client";

import { useState } from "react";
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

  function apply(newFrom: string, newTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPreset(months: number) {
    const to = currentMonthKey();
    const from = shiftMonthKey(to, -(months - 1));
    setCustomOpen(false);
    apply(from, to);
  }

  const nowKey = currentMonthKey();
  const activePreset =
    to === nowKey
      ? PRESETS.find((p) => from === shiftMonthKey(nowKey, -(p.months - 1)))
      : undefined;

  return (
    <div className="card flex flex-wrap items-center gap-2 p-3">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => applyPreset(preset.months)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            !customOpen && activePreset?.label === preset.label
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
