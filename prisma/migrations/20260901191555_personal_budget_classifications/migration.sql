-- Replaces the business-style Classification (Receita/Custo Fixo/Custo
-- Variável) with six personal-budget areas, per product decision: the
-- FinPRO budget should read as "how do I want to split my income across
-- areas of my life" (Custos Obrigatórios, Confortos, Prazeres,
-- Investimentos, Conhecimento, Metas), not a business cost structure.
--
-- Mapping applied to the 14 existing categories (verified against the
-- live data before writing this migration — see chat/PR notes):
--   Salário, Freelance, Outras Receitas   RECEITA        -> RECEITA (unchanged)
--   Investimentos (was Entrada/Receita)   RECEITA        -> INVESTIMENTOS, type ENTRADA -> SAIDA
--     (had 0 transactions referencing it — safe to repurpose; it now
--     represents money allocated *into* investments, an outflow, not
--     investment income received)
--   Moradia, Contas e Utilidades          CUSTO_FIXO     -> CUSTOS_OBRIGATORIOS
--   Assinaturas                           CUSTO_FIXO     -> CONFORTOS
--   Educação                              CUSTO_FIXO     -> CONHECIMENTO
--   Supermercado, Transporte, Saúde,
--     Outras Despesas                     CUSTO_VARIAVEL -> CUSTOS_OBRIGATORIOS
--   Lazer                                 CUSTO_VARIAVEL -> PRAZERES
--   Vestuário                             CUSTO_VARIAVEL -> CONFORTOS
--   (no existing category maps to METAS yet — it's still a first-class
--   classification, just with zero categories under it for now)
--
-- No Transaction rows are deleted, and none of their amountCents/date/
-- userId/description change — only the `classification` snapshot is
-- re-synced to match its category's new classification (step 6).
--
-- The only data actually deleted is the two BudgetClassificationAllocation
-- / BudgetCategoryAllocation rows that existed — they were an ad-hoc test
-- configuration (Custo Fixo 70% / Custo Variável 30%) built for review
-- during development, with no valid 1:1 mapping onto six classifications,
-- and are not a real user's saved budget.

-- 0. Investimentos: Entrada/income category -> Saida/allocation category.
UPDATE "Category" SET type = 'SAIDA' WHERE name = 'Investimentos' AND type = 'ENTRADA';

-- 1. Drop the incompatible test budget configuration (see note above).
DELETE FROM "BudgetCategoryAllocation";
DELETE FROM "BudgetClassificationAllocation";

-- 2. Rebuild the Classification enum with the new set of values.
ALTER TYPE "Classification" RENAME TO "Classification_old";
CREATE TYPE "Classification" AS ENUM (
  'RECEITA',
  'CUSTOS_OBRIGATORIOS',
  'CONFORTOS',
  'PRAZERES',
  'INVESTIMENTOS',
  'CONHECIMENTO',
  'METAS'
);

-- 3. Category.classification: apply the mapping above.
ALTER TABLE "Category"
  ALTER COLUMN classification TYPE "Classification"
  USING (
    CASE
      WHEN name = 'Investimentos' THEN 'INVESTIMENTOS'
      WHEN classification::text = 'RECEITA' THEN 'RECEITA'
      WHEN name IN ('Assinaturas', 'Vestuário') THEN 'CONFORTOS'
      WHEN name = 'Educação' THEN 'CONHECIMENTO'
      WHEN name = 'Lazer' THEN 'PRAZERES'
      ELSE 'CUSTOS_OBRIGATORIOS'
    END
  )::text::"Classification";

-- 4. Transaction.classification: generic fallback cast (exact per-category
--    values are re-synced from Category in step 6, once both columns are
--    on the new type).
ALTER TABLE "Transaction"
  ALTER COLUMN classification TYPE "Classification"
  USING (
    CASE
      WHEN classification::text = 'RECEITA' THEN 'RECEITA'
      ELSE 'CUSTOS_OBRIGATORIOS'
    END
  )::text::"Classification";

-- 5. BudgetClassificationAllocation.classification: table is empty after
--    step 1, so any valid cast target works.
ALTER TABLE "BudgetClassificationAllocation"
  ALTER COLUMN classification TYPE "Classification"
  USING 'CUSTOS_OBRIGATORIOS'::"Classification";

DROP TYPE "Classification_old";

-- 6. Re-sync every transaction's classification snapshot to exactly match
--    its category's current classification (amount/date/user/description
--    untouched).
UPDATE "Transaction" t
SET classification = c.classification
FROM "Category" c
WHERE t."categoryId" = c.id AND t.classification IS DISTINCT FROM c.classification;
