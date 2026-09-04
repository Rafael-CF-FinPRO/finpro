-- Tracks how far a RECORRENTE series has actually generated occurrences
-- up to, independent of which of those Transaction rows the user may
-- have since deleted. Without this, the rolling top-up in
-- src/lib/series.ts (ensureRecurringOccurrences) derives its starting
-- point from MAX(Transaction.date) — so deleting the single latest
-- occurrence ("excluir somente este") would make the next page load
-- silently regenerate it, since nothing would exist past that point
-- anymore. NULL for PARCELADO series (never topped up) and for any
-- RECORRENTE series created before this column existed — those are
-- backfilled from their own transactions once, in the same statement
-- (falling back to startDate when a series has no transactions at all,
-- which cannot actually happen for existing rows but is a safe floor).
ALTER TABLE "TransactionSeries" ADD COLUMN     "generatedUntil" TIMESTAMP(3);

UPDATE "TransactionSeries" s
SET "generatedUntil" = COALESCE(
  (SELECT MAX(t.date) FROM "Transaction" t WHERE t."seriesId" = s.id),
  s."startDate"
)
WHERE s."seriesType" = 'RECORRENTE';
