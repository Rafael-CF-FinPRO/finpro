"use client";

export function PercentageSlider({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel ?? label}
        className="h-2 w-full min-w-[120px] cursor-pointer appearance-none rounded-full bg-slate-200 accent-[var(--primary)]"
      />
      <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
        {value}%
      </span>
    </div>
  );
}
