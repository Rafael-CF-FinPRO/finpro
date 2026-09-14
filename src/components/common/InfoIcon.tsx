import { Info } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

/** The single "ⓘ" trigger used by every info/help tooltip in the app —
 * just the Info glyph itself, in the app's blue accent (--chart-saldo),
 * no background, sized to match the plain-text "ⓘ" character it
 * replaces everywhere (14x14px). Purely the visual trigger: callers
 * still own their own tooltip panel and open/close state (hover-only,
 * hover+click, or click-toggle all coexist across the app), so this
 * only ever receives event handlers/aria props, never renders a panel
 * itself. */
export function InfoIcon({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--chart-saldo)] transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-saldo)]/50 ${className}`}
    >
      <Info className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}
