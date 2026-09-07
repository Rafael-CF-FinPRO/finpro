-- src/lib/default-categories.ts gained a "Cuidados Pessoais" entry
-- under Custos Obrigatórios — it previously only existed under Prazeres
-- e Confortos. Every existing user predates this addition, so backfill
-- it the same way the earlier default-category gap was closed
-- (20260909120000_backfill_missing_default_categories): only for users
-- who don't already have a category matching this exact
-- (name, type, classification), so nobody who already has their own
-- "Cuidados Pessoais" category anywhere gets a duplicate.

INSERT INTO "Category" (id, "userId", name, description, type, classification, "order", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  'Cuidados Pessoais',
  'Gastos necessários com higiene e cuidados básicos do dia a dia, como produtos de higiene pessoal e itens essenciais de saúde.',
  'SAIDA'::"TransactionType",
  'CUSTOS_OBRIGATORIOS'::"Classification",
  101,
  true,
  now()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c
  WHERE c."userId" = u.id
    AND c.name = 'Cuidados Pessoais'
    AND c.type = 'SAIDA'::"TransactionType"
    AND c.classification = 'CUSTOS_OBRIGATORIOS'::"Classification"
);
