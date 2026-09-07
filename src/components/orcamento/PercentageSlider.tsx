"use client";

import { useState } from "react";
import { parseMoneyToCents } from "@/lib/money";
import { centsFromPercentage } from "@/lib/budget-calc";

function formatAmountInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function PercentageSlider({
  label,
  value,
  onChange,
  ariaLabel,
  monthlyIncomeCents,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  /** When given (and > 0), also renders a "Valor orçado" field so the
   * user can type the R$ amount directly instead of dragging the
   * slider — it's converted to the nearest whole percentage under the
   * hood, since that's still what's persisted. */
  monthlyIncomeCents?: number;
}) {
  const canTypeAmount = typeof monthlyIncomeCents === "number" && monthlyIncomeCents > 0;

  // Non-null only while the user is actively editing the amount field —
  // otherwise its text is always derived fresh from `value` (whether it
  // moved via the slider or anything else), so there's nothing to keep
  // in sync and no effect needed.
  const [draftAmountText, setDraftAmountText] = useState<string | null>(null);
  const amountText =
    draftAmountText ??
    (canTypeAmount ? formatAmountInput(centsFromPercentage(monthlyIncomeCents, value)) : "");

  function commitAmount(text: string) {
    if (canTypeAmount) {
      const cents = parseMoneyToCents(text, { allowZero: true });
      if (cents !== null) {
        // Snapped to the nearest 0.5 point (not a whole percent) so a
        // typed R$ amount can land within half a percentage-point step
        // of its true share of income, matching the slider's own
        // granularity below.
        const rawPct = (cents / monthlyIncomeCents) * 100;
        const pct = Math.max(0, Math.min(100, Math.round(rawPct * 2) / 2));
        onChange(pct);
      }
    }
    setDraftAmountText(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel ?? label}
        className="h-2 w-full min-w-[120px] cursor-pointer appearance-none rounded-full bg-[var(--control-track)] accent-[var(--primary)]"
      />
      <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        {value.toLocaleString("pt-BR")}%
      </span>
      {canTypeAmount && (
        <div className="relative shrink-0">
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-[var(--muted)]">
            R$
          </span>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Valor orçado para ${ariaLabel ?? label}`}
            value={amountText}
            onChange={(e) => setDraftAmountText(e.target.value)}
            onBlur={(e) => commitAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="field-input w-28 py-1 pl-7 text-right text-sm"
          />
        </div>
      )}
    </div>
  );
}
