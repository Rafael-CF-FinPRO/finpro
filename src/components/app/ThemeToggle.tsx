"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { THEME_COOKIE_NAME, isValidTheme, type Theme } from "@/lib/theme";

type Mode = Theme | "system";

const OPTIONS: { mode: Mode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Claro", icon: Sun },
  { mode: "dark", label: "Escuro", icon: Moon },
  { mode: "system", label: "Sistema", icon: Monitor },
];

// A tiny pub/sub so the Sidebar's and Topbar's ThemeToggle instances
// (only one is ever visible at a time, by breakpoint, but both stay
// mounted) agree on the active mode the moment either one changes it.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Reads the attribute src/app/layout.tsx already set server-side from
// the cookie — the single source of truth for "what's actually active
// right now". useSyncExternalStore (not useState+useEffect) is what
// makes reading this safe for hydration: getServerSnapshot below
// stands in for the first client render too, matching the server's
// HTML exactly, then React itself re-reads getSnapshot right after and
// re-renders if it differs — no manual effect/setState needed for that
// correction, which is what a plain useState initializer calling this
// directly would otherwise get wrong (document doesn't exist on the
// server, so the two renders would disagree).
function getSnapshot(): Mode {
  const attr = document.documentElement.dataset.theme;
  return isValidTheme(attr) ? attr : "system";
}

function getServerSnapshot(): Mode {
  return "system";
}

function apply(next: Mode) {
  document.documentElement.dataset.theme = next === "system" ? "" : next;
  if (next === "system") {
    document.cookie = `${THEME_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  } else {
    document.cookie = `${THEME_COOKIE_NAME}=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
  }
  for (const listener of listeners) listener();
}

/** Light/Dark/System control — a plain non-httpOnly cookie (read
 * server-side in src/app/layout.tsx to set `data-theme` on `<html>`
 * before first paint) rather than localStorage, so the very first
 * server-rendered response already has the right theme with no
 * flash-of-wrong-theme script needed. "Sistema" just clears the cookie
 * and lets globals.css's prefers-color-scheme media query decide. */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (collapsed) {
    const current = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[2];
    const next = OPTIONS[(OPTIONS.findIndex((o) => o.mode === mode) + 1) % OPTIONS.length];
    return (
      <button
        type="button"
        onClick={() => apply(next.mode)}
        title={`Tema: ${current.label} (clique para ${next.label})`}
        className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <current.icon size={16} className="shrink-0" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--surface-border)] p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          title={option.label}
          onClick={() => apply(option.mode)}
          className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors ${
            mode === option.mode
              ? "bg-[var(--primary)] text-[var(--on-primary)]"
              : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          }`}
        >
          <option.icon size={14} className="shrink-0" />
        </button>
      ))}
    </div>
  );
}
