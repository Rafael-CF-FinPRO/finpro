"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
 * HTML), so its own buttons never trigger the section's toggle. */
export function CollapsibleSection({
  title,
  subtitle,
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

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:opacity-80"
        >
          {icon}
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text-primary)]">{title}</p>
            {subtitle && <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>}
          </div>
          {badge}
        </button>
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
