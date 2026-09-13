"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** Generic clickable-header collapsible — no equivalent exists anywhere
 * else in the app (every other instance is a bespoke local `useState`),
 * but Gestão Patrimonial needs the same open/closed card ~10 times
 * (Cadastros Gerais itself, plus one per cadastro group), which finally
 * justifies pulling it out. `defaultOpen` lets the outer "Cadastros
 * Gerais" wrapper start open while its inner sub-groups start closed,
 * per the spec ("nem todas as sub-tabelas abertas por padrão"). */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[var(--surface-hover)]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0">
            <p className="font-semibold text-[var(--text-primary)]">{title}</p>
            {subtitle && <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>}
          </div>
          {badge}
        </div>
        {open ? (
          <ChevronUp size={18} className="shrink-0 text-[var(--muted)]" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-[var(--muted)]" />
        )}
      </button>
      {open && <div className="border-t border-[var(--surface-border)] p-4">{children}</div>}
    </div>
  );
}
