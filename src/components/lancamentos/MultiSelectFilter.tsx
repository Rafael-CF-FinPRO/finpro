"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type MultiSelectOption = { value: string; label: string };

/** A checkbox-list dropdown for filters that can match more than one
 * value at once (Tag, Meio de Pagamento, Tipo de Lançamento) — plain
 * `<select multiple>` requires ctrl/cmd-click to pick more than one
 * option, which nobody discovers on their own, so this opens a popover
 * with regular checkboxes instead. Closes on an outside click (the
 * fixed transparent backdrop behind the popover) or Escape. */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function toggleValue(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const buttonLabel = selected.length === 0 ? label : `${label} (${selected.length})`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`field-input flex w-auto items-center gap-1.5 py-1.5 ${
          selected.length > 0 ? "border-[var(--primary)] text-[var(--text-primary)]" : ""
        }`}
      >
        {buttonLabel}
        <ChevronDown size={14} className="shrink-0 text-[var(--text-faint)]" />
      </button>

      {open && (
        <>
          {/* Transparent full-screen backdrop — click anywhere outside
              the popover to close it, no click-outside listener needed. */}
          <button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-1.5 shadow-lg">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-[var(--muted)]">Nenhuma opção</p>
            ) : (
              <>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="mb-1 block w-full rounded-md px-2 py-1 text-left text-xs font-medium text-[var(--primary)] hover:bg-[var(--surface-hover)]"
                  >
                    Limpar seleção
                  </button>
                )}
                {options.map((option) => {
                  const isChecked = selected.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isChecked
                            ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]"
                            : "border-[var(--surface-border)]"
                        }`}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        onChange={() => toggleValue(option.value)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
