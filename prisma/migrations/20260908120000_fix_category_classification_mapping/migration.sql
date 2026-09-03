-- Correction pass: two category concepts had drifted from the official
-- Classification → Categories mapping.
--   1. "Mercado" isn't its own category anymore — it folds into
--      "Alimentação" (both under Custos Obrigatórios). Alimentação's
--      description is broadened accordingly since it now covers both
--      eating out and grocery shopping.
--   2. "Cuidados Pessoais" only belongs under Prazeres e Confortos now
--      (it's not in the official Custos Obrigatórios list) — any row
--      still sitting under Custos Obrigatórios folds into the Prazeres
--      e Confortos one.
-- Where both sides of a fold already exist for a user, transactions and
-- budget allocations move over (summed where both have an allocation
-- for the same month) and the now-empty duplicate is removed. Where
-- only the "wrong" one exists, it's renamed/reclassified in place —
-- no data movement needed. No Transaction is deleted and no
-- amountCents/date/userId/description changes anywhere.

-- ============================================================
-- Fix 1 — Mercado -> Alimentação (both Custos Obrigatórios)
-- ============================================================

CREATE TEMP TABLE _mercado_pairs ON COMMIT DROP AS
SELECT m.id AS mercado_id, a.id AS alimentacao_id
FROM "Category" m
JOIN "Category" a
  ON a."userId" = m."userId"
  AND a.name = 'Alimentação'
  AND a.classification = 'CUSTOS_OBRIGATORIOS'
  AND a.type = 'SAIDA'
WHERE m.name = 'Mercado' AND m.classification = 'CUSTOS_OBRIGATORIOS' AND m.type = 'SAIDA';

UPDATE "Transaction" t SET "categoryId" = p.alimentacao_id
FROM _mercado_pairs p WHERE t."categoryId" = p.mercado_id;

UPDATE "BudgetCategoryAllocation" abca
SET percentage = abca.percentage + mbca.percentage
FROM "BudgetCategoryAllocation" mbca
JOIN _mercado_pairs p ON p.mercado_id = mbca."categoryId"
WHERE abca."categoryId" = p.alimentacao_id
  AND abca."budgetProfileId" = mbca."budgetProfileId"
  AND abca."monthKey" = mbca."monthKey";

DELETE FROM "BudgetCategoryAllocation" mbca
USING _mercado_pairs p
WHERE mbca."categoryId" = p.mercado_id
  AND EXISTS (
    SELECT 1 FROM "BudgetCategoryAllocation" abca
    WHERE abca."categoryId" = p.alimentacao_id
      AND abca."budgetProfileId" = mbca."budgetProfileId"
      AND abca."monthKey" = mbca."monthKey"
  );

UPDATE "BudgetCategoryAllocation" mbca
SET "categoryId" = p.alimentacao_id
FROM _mercado_pairs p
WHERE mbca."categoryId" = p.mercado_id;

DELETE FROM "Category" WHERE id IN (SELECT mercado_id FROM _mercado_pairs);

-- Any remaining "Mercado" (user had no separate Alimentação row) simply
-- becomes Alimentação in place.
UPDATE "Category" SET
  name = 'Alimentação',
  description = 'Gastos com comida no dia a dia — supermercado, restaurantes, lanches e refeições fora de casa.'
WHERE name = 'Mercado' AND classification = 'CUSTOS_OBRIGATORIOS' AND type = 'SAIDA';

-- Broaden the description on every pre-existing Alimentação row too,
-- now that it covers grocery shopping as well as eating out.
UPDATE "Category" SET
  description = 'Gastos com comida no dia a dia — supermercado, restaurantes, lanches e refeições fora de casa.'
WHERE name = 'Alimentação' AND classification = 'CUSTOS_OBRIGATORIOS' AND type = 'SAIDA';

-- ============================================================
-- Fix 2 — Cuidados Pessoais under Custos Obrigatórios folds into the
-- one under Prazeres e Confortos (its only official home now).
-- ============================================================

CREATE TEMP TABLE _cuidados_pairs ON COMMIT DROP AS
SELECT co.id AS custos_id, pc.id AS prazeres_id
FROM "Category" co
JOIN "Category" pc
  ON pc."userId" = co."userId"
  AND pc.name = 'Cuidados Pessoais'
  AND pc.classification = 'PRAZERES_E_CONFORTOS'
  AND pc.type = 'SAIDA'
WHERE co.name = 'Cuidados Pessoais' AND co.classification = 'CUSTOS_OBRIGATORIOS' AND co.type = 'SAIDA';

UPDATE "Transaction" t SET "categoryId" = p.prazeres_id, classification = 'PRAZERES_E_CONFORTOS'
FROM _cuidados_pairs p WHERE t."categoryId" = p.custos_id;

UPDATE "BudgetCategoryAllocation" pbca
SET percentage = pbca.percentage + cbca.percentage
FROM "BudgetCategoryAllocation" cbca
JOIN _cuidados_pairs p ON p.custos_id = cbca."categoryId"
WHERE pbca."categoryId" = p.prazeres_id
  AND pbca."budgetProfileId" = cbca."budgetProfileId"
  AND pbca."monthKey" = cbca."monthKey";

DELETE FROM "BudgetCategoryAllocation" cbca
USING _cuidados_pairs p
WHERE cbca."categoryId" = p.custos_id
  AND EXISTS (
    SELECT 1 FROM "BudgetCategoryAllocation" pbca
    WHERE pbca."categoryId" = p.prazeres_id
      AND pbca."budgetProfileId" = cbca."budgetProfileId"
      AND pbca."monthKey" = cbca."monthKey"
  );

UPDATE "BudgetCategoryAllocation" cbca
SET "categoryId" = p.prazeres_id
FROM _cuidados_pairs p
WHERE cbca."categoryId" = p.custos_id;

DELETE FROM "Category" WHERE id IN (SELECT custos_id FROM _cuidados_pairs);

-- Any remaining "Cuidados Pessoais" under Custos Obrigatórios (user had
-- no separate Prazeres e Confortos row) is simply reclassified in place.
UPDATE "Category" SET
  classification = 'PRAZERES_E_CONFORTOS',
  description = 'Cuidados extras com beleza e bem-estar, como salão, spa ou produtos além do básico.'
WHERE name = 'Cuidados Pessoais' AND classification = 'CUSTOS_OBRIGATORIOS' AND type = 'SAIDA';
