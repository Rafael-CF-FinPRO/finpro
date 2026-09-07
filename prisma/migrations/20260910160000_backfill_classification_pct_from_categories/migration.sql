-- A Classification's percentage is no longer set independently — it's
-- always the sum of its own (active) Categories' percentages
-- (src/app/actions/budget.ts's saveBudgetDistributionAction now
-- computes and persists exactly that on every save). The *old* system
-- only ever checked that a classification's categories didn't exceed
-- its own percentage (a ceiling, not a target), so plenty of existing
-- BudgetClassificationAllocation rows currently hold a value that
-- doesn't match what their categories actually sum to. Backfill every
-- existing row to the correct sum now, rather than leaving it stale
-- until the next time each user happens to re-save their budget.

WITH sums AS (
  SELECT
    bca."budgetProfileId",
    c.classification,
    bca."monthKey",
    SUM(bca.percentage) AS total
  FROM "BudgetCategoryAllocation" bca
  JOIN "Category" c ON c.id = bca."categoryId"
  WHERE c."isActive" = true
  GROUP BY bca."budgetProfileId", c.classification, bca."monthKey"
)
UPDATE "BudgetClassificationAllocation" bca_cls
SET percentage = sums.total
FROM sums
WHERE sums."budgetProfileId" = bca_cls."budgetProfileId"
  AND sums.classification = bca_cls.classification
  AND sums."monthKey" = bca_cls."monthKey"
  AND bca_cls.percentage IS DISTINCT FROM sums.total;

-- A classification row with no matching (active-category) allocations
-- at all for that month — nothing distributed under it yet — becomes 0;
-- the UPDATE above only touches rows that found a matching sum.
UPDATE "BudgetClassificationAllocation" bca_cls
SET percentage = 0
WHERE percentage <> 0
  AND NOT EXISTS (
    SELECT 1
    FROM "BudgetCategoryAllocation" bca
    JOIN "Category" c ON c.id = bca."categoryId"
    WHERE c."isActive" = true
      AND bca."budgetProfileId" = bca_cls."budgetProfileId"
      AND bca."monthKey" = bca_cls."monthKey"
      AND c.classification = bca_cls.classification
  );
