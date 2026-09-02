"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { shiftMonthKey, formatMonthKeyLabel } from "@/lib/dates";

export function MonthNavigator({ monthKey }: { monthKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(newMonthKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonthKey);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-center gap-4 sm:justify-start">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => goTo(shiftMonthKey(monthKey, -1))}
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
        {formatMonthKeyLabel(monthKey)}
      </p>
      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => goTo(shiftMonthKey(monthKey, 1))}
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
