-- Enforces at most one occurrence per (series, date) — a correctness
-- invariant (both generators in src/lib/series.ts only ever produce
-- one row per date within a series) that also protects against
-- concurrent page loads racing ensureRecurringOccurrences's top-up:
-- with this in place, its createMany can use skipDuplicates so a
-- duplicate concurrent insert silently no-ops instead of creating
-- doubled-up occurrences. NULL seriesId rows (every normal, non-series
-- transaction) never conflict with each other under this index.
CREATE UNIQUE INDEX "Transaction_seriesId_date_key" ON "Transaction"("seriesId", "date");
