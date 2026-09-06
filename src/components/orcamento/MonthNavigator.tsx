"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { shiftMonthKey, formatMonthKeyLabel } from "@/lib/dates";

export function MonthNavigator({ monthKey }: { monthKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // Shown immediately on click instead of waiting for the new page to
  // actually load — otherwise the label just sat still for however long
  // the round trip took, with nothing on screen acknowledging the click.
  // Cleared once `monthKey` (the real, server-confirmed value) catches up
  // (adjusting state during render on a prop change, per React's own
  // guidance, rather than an effect that would cause an extra commit).
  const [prevMonthKey, setPrevMonthKey] = useState(monthKey);
  const [pendingMonthKey, setPendingMonthKey] = useState<string | null>(null);
  if (monthKey !== prevMonthKey) {
    setPrevMonthKey(monthKey);
    setPendingMonthKey(null);
  }

  const displayedMonthKey = pendingMonthKey ?? monthKey;

  function hrefFor(newMonthKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonthKey);
    return `${pathname}?${params.toString()}`;
  }

  // Only 2 destinations exist from here (prev/next of whichever month is
  // currently shown), so both are cheap to prefetch unconditionally.
  useEffect(() => {
    router.prefetch(hrefFor(shiftMonthKey(displayedMonthKey, -1)));
    router.prefetch(hrefFor(shiftMonthKey(displayedMonthKey, 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedMonthKey, pathname, searchParams]);

  function goTo(newMonthKey: string) {
    setPendingMonthKey(newMonthKey);
    startTransition(() => {
      router.push(hrefFor(newMonthKey));
    });
  }

  return (
    <div
      className={`flex items-center justify-center gap-4 transition-opacity sm:justify-start ${
        isPending ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => goTo(shiftMonthKey(displayedMonthKey, -1))}
        className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <p className="min-w-[10ch] text-center text-lg font-semibold text-stone-900">
        {formatMonthKeyLabel(displayedMonthKey)}
      </p>
      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => goTo(shiftMonthKey(displayedMonthKey, 1))}
        className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 18l6-6-6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
