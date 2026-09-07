-- Widen BudgetClassificationAllocation.percentage and
-- BudgetCategoryAllocation.percentage from integer to double precision
-- so the budget's percentage sliders can work in 0.5-point steps
-- instead of whole percentage points only. Lossless for every existing
-- value (every stored integer converts exactly to its float
-- equivalent).
ALTER TABLE "BudgetClassificationAllocation"
  ALTER COLUMN "percentage" TYPE DOUBLE PRECISION USING "percentage"::DOUBLE PRECISION;

ALTER TABLE "BudgetCategoryAllocation"
  ALTER COLUMN "percentage" TYPE DOUBLE PRECISION USING "percentage"::DOUBLE PRECISION;
