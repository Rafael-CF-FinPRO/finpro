-- Orçamento simplification: 4 classifications (Essenciais / Não
-- Essenciais / Dívidas / Investimentos) become 3, in plainer language:
--   Essenciais        -> Custos Obrigatórios
--   Não Essenciais    -> Prazeres e Confortos
--   Dívidas           -> folded into Custos Obrigatórios (it was never
--                        its own concept for the user, just "money
--                        that's obligated to go out")
--   Investimentos     -> unchanged
-- Receita is untouched throughout (it isn't a budget classification).
--
-- No Transaction is deleted and no amountCents/date/userId/description
-- changes anywhere. Category rows are renamed/reclassified/consolidated
-- in place (never deleted) except the 4 duplicate Dívidas categories
-- that get folded into one, which — once empty — are safe to remove.

-- ============================================================
-- Phase A — consolidate the 5 old Dívidas categories into a single
-- "Financiamentos e Compromissos Financeiros" category per user, still
-- labeled classification = 'DIVIDAS' at this point (the label itself is
-- renamed away in Phase E, once nothing needs matching against it by
-- name anymore).
-- ============================================================

CREATE TEMP TABLE _dividas_map ON COMMIT DROP AS
SELECT id, "userId",
  ROW_NUMBER() OVER (
    PARTITION BY "userId"
    ORDER BY CASE WHEN name = 'Financiamentos e Dívidas Geral' THEN 0 ELSE 1 END, id
  ) AS rn
FROM "Category"
WHERE classification = 'DIVIDAS' AND type = 'SAIDA';

CREATE TEMP TABLE _dividas_winners ON COMMIT DROP AS
SELECT "userId", id AS winner_id FROM _dividas_map WHERE rn = 1;

CREATE TEMP TABLE _dividas_losers ON COMMIT DROP AS
SELECT "userId", id AS loser_id FROM _dividas_map WHERE rn > 1;

-- The winner becomes the one consolidated category.
UPDATE "Category" SET
  name = 'Financiamentos e Compromissos Financeiros',
  description = 'Gastos com financiamentos, empréstimos, consórcios, parcelamentos e outros compromissos financeiros que precisam ser pagos.'
WHERE id IN (SELECT winner_id FROM _dividas_winners);

-- Re-point any Transaction still referencing a loser category (none
-- exist today, but this keeps the migration correct regardless).
UPDATE "Transaction" t SET "categoryId" = w.winner_id
FROM _dividas_losers l
JOIN _dividas_winners w ON w."userId" = l."userId"
WHERE t."categoryId" = l.loser_id;

-- Merge BudgetCategoryAllocation rows: where the winner already has a
-- row for the same (budgetProfileId, monthKey), add the loser's
-- percentage into it and drop the loser row.
UPDATE "BudgetCategoryAllocation" wbca
SET percentage = wbca.percentage + lbca.percentage
FROM "BudgetCategoryAllocation" lbca
JOIN _dividas_losers l ON l.loser_id = lbca."categoryId"
JOIN _dividas_winners w ON w."userId" = l."userId"
WHERE wbca."categoryId" = w.winner_id
  AND wbca."budgetProfileId" = lbca."budgetProfileId"
  AND wbca."monthKey" = lbca."monthKey";

DELETE FROM "BudgetCategoryAllocation" lbca
USING _dividas_losers l
WHERE lbca."categoryId" = l.loser_id
  AND EXISTS (
    SELECT 1 FROM "BudgetCategoryAllocation" wbca
    JOIN _dividas_winners w ON w."userId" = l."userId"
    WHERE wbca."categoryId" = w.winner_id
      AND wbca."budgetProfileId" = lbca."budgetProfileId"
      AND wbca."monthKey" = lbca."monthKey"
  );

-- Any remaining loser allocation row (no matching winner row for that
-- month) simply gets adopted by the winner instead of being summed.
UPDATE "BudgetCategoryAllocation" lbca
SET "categoryId" = w.winner_id
FROM _dividas_losers l
JOIN _dividas_winners w ON w."userId" = l."userId"
WHERE lbca."categoryId" = l.loser_id;

-- The 4 duplicate categories per user are now unreferenced — safe to
-- remove (unlike a user-visible "inactivate", these never really
-- existed as distinct concepts going forward, they're merging into one).
DELETE FROM "Category" WHERE id IN (SELECT loser_id FROM _dividas_losers);

-- ============================================================
-- Phase B — merge each Dívidas BudgetClassificationAllocation row into
-- the Essenciais row for the same (budgetProfileId, monthKey), before
-- the enum rebuild would otherwise collide the two labels together.
-- ============================================================

UPDATE "BudgetClassificationAllocation" e
SET percentage = e.percentage + d.percentage
FROM "BudgetClassificationAllocation" d
WHERE d.classification = 'DIVIDAS'
  AND e.classification = 'ESSENCIAIS'
  AND e."budgetProfileId" = d."budgetProfileId"
  AND e."monthKey" = d."monthKey";

DELETE FROM "BudgetClassificationAllocation" dd
WHERE dd.classification = 'DIVIDAS'
  AND EXISTS (
    SELECT 1 FROM "BudgetClassificationAllocation" e
    WHERE e.classification = 'ESSENCIAIS'
      AND e."budgetProfileId" = dd."budgetProfileId"
      AND e."monthKey" = dd."monthKey"
  );
-- Any leftover Dívidas row with no matching Essenciais row for that
-- month is left as-is — Phase E's enum rebuild relabels it to Custos
-- Obrigatórios directly, no merge needed.

-- ============================================================
-- Phase C — rename categories that were split into "- Essencial" /
-- "- Não Essencial" pairs back to their plain concept name (the new
-- structure differentiates duplicates via Classification only, never
-- via the name — see src/lib/category-display.ts), plus the handful of
-- straight renames the new structure calls for. Still matched against
-- the old classification labels.
-- ============================================================

UPDATE "Category" c SET name = v.new_name, description = v.new_description
FROM (VALUES
  ('Pets - Essencial', 'ESSENCIAIS', 'Pets', 'Gastos necessários com alimentação, saúde e cuidados básicos do seu animal.'),
  ('Pets - Não Essencial', 'NAO_ESSENCIAIS', 'Pets', 'Gastos opcionais com seu animal, como acessórios, serviços e outros cuidados que não são indispensáveis.'),
  ('Transporte - Essencial', 'ESSENCIAIS', 'Transporte', 'Deslocamentos do dia a dia para trabalhar ou estudar, como ônibus, metrô, combustível ou aplicativo.'),
  ('Transporte - Não Essencial', 'NAO_ESSENCIAIS', 'Transporte', 'Deslocamentos por lazer ou conveniência, como aplicativo para sair à noite ou passeios de carro.'),
  ('Cuidados Pessoais - Essencial', 'ESSENCIAIS', 'Cuidados Pessoais', 'Itens básicos de higiene e saúde pessoal que você não pode deixar de ter.'),
  ('Cuidados Pessoais - Não Essencial', 'NAO_ESSENCIAIS', 'Cuidados Pessoais', 'Cuidados extras com beleza e bem-estar, como salão, spa ou produtos além do básico.'),
  ('Prestadores de Serviço - Essencial', 'ESSENCIAIS', 'Prestadores de Serviço e Serviços', 'Serviços indispensáveis para a casa funcionar, como encanador, eletricista ou diarista.'),
  ('Prestadores de Serviço - Não Essencial', 'NAO_ESSENCIAIS', 'Prestadores de Serviço e Serviços', 'Serviços contratados por conveniência ou conforto, não por necessidade imediata.'),
  ('Imposto', 'ESSENCIAIS', 'Impostos', 'Impostos e taxas obrigatórias, como IPVA, IPTU ou Imposto de Renda.'),
  ('Essenciais Geral', 'ESSENCIAIS', 'Outros Custos Obrigatórios', 'Gastos indispensáveis do dia a dia que não se encaixam em nenhuma outra categoria de custo obrigatório.'),
  ('Outros Não Essenciais', 'NAO_ESSENCIAIS', 'Outros Prazeres e Confortos', 'Qualquer outro gasto por escolha que não se encaixa nas demais categorias de prazer e conforto.'),
  ('Lanches, Restaurante e Confraternizações', 'NAO_ESSENCIAIS', 'Lanches, Restaurantes e Confraternizações', 'Idas a restaurantes, bares, lanches e encontros sociais por lazer.')
) AS v(old_name, old_classification, new_name, new_description)
WHERE c.name = v.old_name AND c.classification = v.old_classification::"Classification";

-- ============================================================
-- Phase D — give every existing user the new "Metas e Projetos"
-- category under Investimentos (new users get it from
-- src/lib/default-categories.ts at registration instead).
-- ============================================================

INSERT INTO "Category" (id, "userId", name, description, type, classification, "order", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  'Metas e Projetos',
  'Dinheiro separado para objetivos específicos no futuro, como trocar de carro, fazer uma reforma, comprar um imóvel ou realizar outro projeto.',
  'SAIDA',
  'INVESTIMENTOS',
  COALESCE((SELECT MAX("order") FROM "Category" WHERE "userId" = u.id AND type = 'SAIDA'), 0) + 1,
  true,
  now()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c WHERE c."userId" = u.id AND c.name = 'Metas e Projetos' AND c.type = 'SAIDA'
);

-- ============================================================
-- Phase E — enum rebuild: Essenciais/Dívidas -> Custos Obrigatórios,
-- Não Essenciais -> Prazeres e Confortos, Receita/Investimentos
-- unchanged. A straight RENAME VALUE isn't enough here since two old
-- labels (Essenciais, Dívidas) collapse into one new label.
-- ============================================================

CREATE TYPE "Classification_new" AS ENUM ('RECEITA', 'CUSTOS_OBRIGATORIOS', 'PRAZERES_E_CONFORTOS', 'INVESTIMENTOS');

ALTER TABLE "Category" ALTER COLUMN classification TYPE "Classification_new" USING (
  CASE classification::text
    WHEN 'ESSENCIAIS' THEN 'CUSTOS_OBRIGATORIOS'
    WHEN 'DIVIDAS' THEN 'CUSTOS_OBRIGATORIOS'
    WHEN 'NAO_ESSENCIAIS' THEN 'PRAZERES_E_CONFORTOS'
    ELSE classification::text
  END
)::"Classification_new";

ALTER TABLE "Transaction" ALTER COLUMN classification TYPE "Classification_new" USING (
  CASE classification::text
    WHEN 'ESSENCIAIS' THEN 'CUSTOS_OBRIGATORIOS'
    WHEN 'DIVIDAS' THEN 'CUSTOS_OBRIGATORIOS'
    WHEN 'NAO_ESSENCIAIS' THEN 'PRAZERES_E_CONFORTOS'
    ELSE classification::text
  END
)::"Classification_new";

ALTER TABLE "BudgetClassificationAllocation" ALTER COLUMN classification TYPE "Classification_new" USING (
  CASE classification::text
    WHEN 'ESSENCIAIS' THEN 'CUSTOS_OBRIGATORIOS'
    WHEN 'DIVIDAS' THEN 'CUSTOS_OBRIGATORIOS'
    WHEN 'NAO_ESSENCIAIS' THEN 'PRAZERES_E_CONFORTOS'
    ELSE classification::text
  END
)::"Classification_new";

DROP TYPE "Classification";
ALTER TYPE "Classification_new" RENAME TO "Classification";
