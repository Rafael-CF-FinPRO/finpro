"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InfoIcon } from "@/components/common/InfoIcon";

/** Discreet info trigger for a group's explanatory text — same visual
 * (InfoIcon) and same hover/focus interaction used by every other
 * info tooltip in the app. Deliberately hover/focus only, no
 * click-toggle: the spec for this panel is explicit that the tooltip
 * "deve aparecer somente ao passar o mouse ou focar o ícone" — a real
 * `<button>` gets keyboard support for free via onFocus/onBlur,
 * without needing a click handler. Rendered as a sibling of the
 * section's title button, never nested inside it (nested interactive
 * elements are invalid HTML and would fight the same click for two
 * different purposes). */
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex shrink-0">
      <InfoIcon
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
        aria-label="Mais informações"
        aria-expanded={open}
      />
      {open && (
        <span
          role="tooltip"
          className="tooltip-pop pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-2.5 text-left text-[11px] leading-relaxed text-[var(--text-tertiary)] shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}

/** Generic clickable-header collapsible — no equivalent exists anywhere
 * else in the app (every other instance is a bespoke local `useState`),
 * but Gestão Patrimonial needs the same open/closed card ~10 times
 * (Cadastros Gerais itself, plus one per cadastro group).
 *
 * Uncontrolled by default (`defaultOpen`, own internal state) — used
 * for the outer "Cadastros Gerais" wrapper. Pass `open`/`onToggle` to
 * put it in controlled mode instead, so a parent can drive several
 * instances at once (the "Expandir/Recolher todas" control in
 * PatrimonioBoard) while each section's own header remains independently
 * clickable too. `headerActions` renders as a sibling of the title
 * button (never nested inside it — nested `<button>`s are invalid
 * HTML), so its own buttons never trigger the section's toggle.
 *
 * `subtitle` renders as a permanent line under the title (used by the
 * outer "Cadastros Gerais" wrapper); `tooltip` instead renders a small
 * "ⓘ" beside the title that reveals the same kind of text only on
 * hover/focus (used by each inner cadastro group, per the visual-polish
 * spec) — a given instance passes one or the other, never both. */
export function CollapsibleSection({
  title,
  subtitle,
  tooltip,
  icon,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  badge,
  headerActions,
  children,
}: {
  title: string;
  subtitle?: string;
  tooltip?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function toggle() {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen((prev) => !prev);
    }
  }

  function onHeaderKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 p-4">
        {/* A `div[role="button"]` rather than a real `<button>` — it
            needs to contain the InfoTooltip's own `<button>`, and the
            HTML content model forbids interactive descendants (like a
            nested button) inside a real `<button>`. Manually replicates
            the bits a native button gives for free: tabIndex, the
            Enter/Space activation above, and the pointer cursor below. */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={onHeaderKeyDown}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left hover:opacity-80"
        >
          {icon}
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text-primary)]">{title}</p>
            {subtitle && <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>}
          </div>
          {badge}
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Recolher" : "Expandir"}
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
      {open && <div className="border-t border-[var(--surface-border)] p-4">{children}</div>}
    </div>
  );
}
