"use client";

import { useState } from "react";
import { HistoricalSummaryStrip } from "./HistoricalSummaryStrip";
import { HistoricalClassificationCards } from "./HistoricalClassificationCards";
import type { BudgetHistory } from "@/lib/budget";

/** Wraps the period's 4 headline cards and 3 classification cards with
 * one shared Média/Total toggle — a single control governing both
 * groups at once, since they're showing the same underlying period
 * figures at two different granularities (per-month average vs the
 * period's raw sum), not two independent things each needing their own
 * switch. */
export function HistoricalOverviewCards({ history }: { history: BudgetHistory }) {
  const [view, setView] = useState<"media" | "total">("media");

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-[var(--surface-border)] p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("media")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === "media" ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Média mensal
          </button>
          <button
            type="button"
            onClick={() => setView("total")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === "total" ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            Total do período
          </button>
        </div>
      </div>
      <HistoricalSummaryStrip history={history} view={view} />
      <HistoricalClassificationCards months={history.months} view={view} />
    </div>
  );
}
