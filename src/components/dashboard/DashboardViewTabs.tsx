"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const TABS: { value: "mensal" | "historico"; label: string }[] = [
  { value: "mensal", label: "Visão Mensal" },
  { value: "historico", label: "Visão Histórica" },
];

export function DashboardViewTabs({ view }: { view: "mensal" | "historico" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => goTo(tab.value)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
            view === tab.value
              ? "bg-[var(--primary)] text-white"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
