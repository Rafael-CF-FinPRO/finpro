"use client";

/** Compact switch + state label, same visual language as the "Pago"/
 * "Não pago" toggle in Lançamentos (TransactionsBoard.tsx's
 * StatusToggle) — a fixed label width so the label's own reflow never
 * shifts whatever sits after it in the row. Purely presentational: the
 * caller owns whether the click updates local edit-row state or fires
 * a server action immediately (see ProtectionTable.tsx's two uses). */
export function ToggleSwitch({
  checked,
  onLabel,
  offLabel,
  onChange,
  disabled,
}: {
  checked: boolean;
  onLabel: string;
  offLabel: string;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      title={checked ? offLabel : onLabel}
      className="inline-flex items-center gap-2 disabled:opacity-60"
    >
      {/* --primary flips between near-black/near-white across
          light/dark (it's a button-text-contrast color, not an accent),
          so it can't double as this switch's "on" color — --chart-saldo
          is this app's one existing theme-aware blue, already proven
          legible against a dark surface. */}
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[var(--chart-saldo)]" : "bg-[var(--control-track)]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-1"
          }`}
        />
      </span>
      <span
        className={`w-20 shrink-0 text-left text-xs font-medium ${checked ? "text-[var(--text-primary)]" : "text-[var(--muted)]"}`}
      >
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}
