"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const TABS: { value: "mensal" | "historico"; label: string }[] = [
  { value: "mensal", label: "Visão Mensal" },
  { value: "historico", label: "Visão Histórica" },
];

export function DashboardViewTabs({ view }: { view: "mensal" | "historico" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // The tab a user just clicked shows as active immediately — `view`
  // itself only updates once the new page has actually loaded, which
  // otherwise left the button appearing to ignore the click for however
  // long the round trip took. Cleared once `view` catches up (adjusting
  // state during render on a prop change, per React's own guidance,
  // rather than an effect that would cause an extra commit).
  const [prevView, setPrevView] = useState(view);
  const [pendingView, setPendingView] = useState<string | null>(null);
  if (view !== prevView) {
    setPrevView(view);
    setPendingView(null);
  }

  function hrefFor(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", value);
    return `${pathname}?${params.toString()}`;
  }

  // Both destinations are known upfront (unlike an arbitrary month), so
  // both are worth prefetching unconditionally — by the time a click
  // happens the RSC payload is very likely already cached.
  useEffect(() => {
    for (const tab of TABS) {
      router.prefetch(hrefFor(tab.value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  function goTo(value: string) {
    if (value === (pendingView ?? view)) return;
    setPendingView(value);
    startTransition(() => {
      router.push(hrefFor(value));
    });
  }

  const activeView = pendingView ?? view;

  return (
    <div
      className={`inline-flex rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-1 transition-opacity ${
        isPending ? "opacity-70" : ""
      }`}
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => goTo(tab.value)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            activeView === tab.value
              ? "bg-[var(--primary)] text-[var(--on-primary)]"
              : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
