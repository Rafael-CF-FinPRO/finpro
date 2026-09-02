-- Restructures the Orçamento module's Classification taxonomy from the
-- six areas-of-life set (Custos Obrigatórios/Confortos/Prazeres/
-- Investimentos/Conhecimento/Metas) to the four-area personal-budget
-- structure used by the reference spreadsheet's "Orçamento de Gastos"
-- sheet: Essenciais, Não Essenciais, Financiamentos, Investimentos.
--
-- Mapping applied to existing Category/Transaction rows (verified against
-- live data before writing this migration):
--   RECEITA               -> RECEITA (unchanged)
--   CUSTOS_OBRIGATORIOS   -> ESSENCIAIS
--   CONFORTOS             -> NAO_ESSENCIAIS
--   PRAZERES              -> NAO_ESSENCIAIS
--   CONHECIMENTO          -> ESSENCIAIS       (e.g. "Educação")
--   METAS                 -> ESSENCIAIS       (fallback only — no
--     existing Category or Transaction actually used METAS; it only
--     appeared in BudgetClassificationAllocation rows, which are reset
--     below since they're a saved percentage split under a taxonomy that
--     no longer exists, not a financial record)
--   INVESTIMENTOS         -> INVESTIMENTOS (unchanged)
--
-- No Category or Transaction row is deleted, and none of their
-- amountCents/date/userId/description/categoryId change — only the
-- `classification` snapshot moves to its new value (Transaction is
-- re-synced from Category in step 7, exactly as in the prior
-- personal_budget_classifications migration).
--
-- BudgetClassificationAllocation / BudgetCategoryAllocation rows ARE
-- deleted: they represent a percentage split configured under the old
-- six-area taxonomy, which has no valid 1:1 mapping onto the new four
-- areas (a user's old "Confortos: 5%" doesn't become any specific
-- "Não Essenciais: N%" — that's a decision only the user can make again
-- under the new structure). This mirrors the precedent set by
-- 20260901191555_personal_budget_classifications. BudgetProfile itself
-- (monthlyIncomeCents) is untouched — the reference income is not tied
-- to the classification taxonomy.

-- 1. Drop the saved percentage splits (see rationale above). Renda
--    (BudgetProfile) is not touched.
DELETE FROM "BudgetCategoryAllocation";
DELETE FROM "BudgetClassificationAllocation";

-- 2. Category can now repeat a name across different Classifications for
--    the same user (e.g. "Pets" under both Essenciais and Não
--    Essenciais) — widen the unique constraint before anything else, so
--    later steps in this migration (or a retry) never trip over the old,
--    narrower one.
DROP INDEX "Category_userId_name_type_key";

-- 3. Rebuild the Classification enum with the new four-area set.
ALTER TYPE "Classification" RENAME TO "Classification_old";
CREATE TYPE "Classification" AS ENUM (
  'RECEITA',
  'ESSENCIAIS',
  'NAO_ESSENCIAIS',
  'FINANCIAMENTOS',
  'INVESTIMENTOS'
);

-- 4. Category.classification: apply the mapping above.
ALTER TABLE "Category"
  ALTER COLUMN classification TYPE "Classification"
  USING (
    CASE classification::text
      WHEN 'RECEITA' THEN 'RECEITA'
      WHEN 'INVESTIMENTOS' THEN 'INVESTIMENTOS'
      WHEN 'CONFORTOS' THEN 'NAO_ESSENCIAIS'
      WHEN 'PRAZERES' THEN 'NAO_ESSENCIAIS'
      WHEN 'CONHECIMENTO' THEN 'ESSENCIAIS'
      WHEN 'CUSTOS_OBRIGATORIOS' THEN 'ESSENCIAIS'
      ELSE 'ESSENCIAIS'
    END
  )::text::"Classification";

-- 5. Transaction.classification: same mapping (re-synced precisely from
--    Category in step 7 — this just gets the column onto the new type).
ALTER TABLE "Transaction"
  ALTER COLUMN classification TYPE "Classification"
  USING (
    CASE classification::text
      WHEN 'RECEITA' THEN 'RECEITA'
      WHEN 'INVESTIMENTOS' THEN 'INVESTIMENTOS'
      WHEN 'CONFORTOS' THEN 'NAO_ESSENCIAIS'
      WHEN 'PRAZERES' THEN 'NAO_ESSENCIAIS'
      WHEN 'CONHECIMENTO' THEN 'ESSENCIAIS'
      WHEN 'CUSTOS_OBRIGATORIOS' THEN 'ESSENCIAIS'
      ELSE 'ESSENCIAIS'
    END
  )::text::"Classification";

-- 6. BudgetClassificationAllocation.classification: table is empty after
--    step 1, so any valid cast target works.
ALTER TABLE "BudgetClassificationAllocation"
  ALTER COLUMN classification TYPE "Classification"
  USING 'ESSENCIAIS'::"Classification";

DROP TYPE "Classification_old";

-- 7. Re-sync every transaction's classification snapshot to exactly
--    match its category's current classification (amount/date/user/
--    description untouched).
UPDATE "Transaction" t
SET classification = c.classification
FROM "Category" c
WHERE t."categoryId" = c.id AND t.classification IS DISTINCT FROM c.classification;

-- 8. New unique constraint: same (name, type) can now repeat across
--    different classifications, but not within the same one.
CREATE UNIQUE INDEX "Category_userId_name_type_classification_key"
  ON "Category"("userId", name, type, classification);
