"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Generic hover/focus-to-reveal tooltip wrapping arbitrary trigger
 * content — used where the displayed VALUE itself is the hover target
 * (Taxa de Correção Anual %, Rendimento do Aluguel %), unlike
 * CollapsibleSection's InfoIcon pattern ("ⓘ beside a label"). Same
 * elegant styling (dark surface, subtle border, shadow, fade-in) and
 * same hover/focus-only trigger model as every other tooltip in the
 * app.
 *
 * Portaled to document.body with `position: fixed` computed from the
 * trigger's own bounding rect — this cell sits inside a table wrapped
 * in `overflow-x-auto` (kept for the table's own horizontal-scroll
 * containment), and CSS quirk: setting only overflow-x to a value
 * other than visible silently turns overflow-y into `auto` too, which
 * would otherwise clip a plain `position: absolute` panel the moment
 * it grew taller than the scroll container. */
export function ValueTooltip({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  function handleOpen() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  }

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        onMouseEnter={handleOpen}
        onMouseLeave={() => setOpen(false)}
        onFocus={handleOpen}
        onBlur={() => setOpen(false)}
        className="inline-flex cursor-help items-center justify-center focus:outline-none"
      >
        {trigger}
      </span>
      {open &&
        position &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            className="tooltip-pop pointer-events-none fixed z-30 w-64 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-left text-[11px] leading-relaxed text-[var(--text-tertiary)] shadow-lg"
          >
            {children}
          </span>,
          document.body
        )}
    </>
  );
}
