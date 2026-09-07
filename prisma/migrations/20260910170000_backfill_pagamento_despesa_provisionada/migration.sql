-- src/lib/default-categories.ts gained a "Pagamento de Despesa
-- Provisionada" entry under Neutro — every existing user predates this
-- addition, so backfill it the same way earlier default-category gaps
-- were closed (20260909120000_backfill_missing_default_categories,
-- 20260910150000_backfill_cuidados_pessoais_custos): only for users who
-- don't already have a category matching this exact
-- (name, type, classification), so nobody who already has their own
-- category under that name gets a duplicate.
--
-- Every existing user's 3 Neutro categories were themselves backfilled
-- earlier (20260910130000_backfill_neutro_categories) at order
-- 101/102/103, not the template's original 1/2/3 — a flat 101 here
-- would tie with their existing "Pagamento de Fatura" instead of
-- sorting after it, so this one's order is computed per user as one
-- past whatever Neutro order they already have.

INSERT INTO "Category" (id, "userId", name, description, type, classification, "order", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  u.id,
  'Pagamento de Despesa Provisionada',
  'Pagamento de uma despesa grande e prevista, como o IPVA do carro, usando o dinheiro que você já vinha separando mês a mês e lançando como saída — não é um gasto novo, apenas a quitação do valor que você já havia provisionado.',
  'NEUTRO'::"TransactionType",
  'NEUTRA'::"Classification",
  COALESCE((SELECT MAX(c2."order") FROM "Category" c2 WHERE c2."userId" = u.id AND c2.type = 'NEUTRO'::"TransactionType"), 0) + 1,
  true,
  now()
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" c
  WHERE c."userId" = u.id
    AND c.name = 'Pagamento de Despesa Provisionada'
    AND c.type = 'NEUTRO'::"TransactionType"
    AND c.classification = 'NEUTRA'::"Classification"
);
