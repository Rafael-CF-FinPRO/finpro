-- Seeds every existing user with the starter set of NEUTRO/NEUTRA
-- categories (src/lib/default-categories.ts), same as the prior
-- backfill for the other classifications — new users get these from
-- registration onward; this catches everyone who registered before
-- today. Matched by (name, type, classification) so nothing is
-- duplicated if a user somehow already has one of these.
INSERT INTO "Category" (id, "userId", name, description, type, classification, "order", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  ranked."userId",
  ranked.name,
  ranked.description,
  ranked.type::"TransactionType",
  ranked.classification::"Classification",
  100 + ranked.rn,
  true,
  now()
FROM (
  SELECT
    u.id AS "userId",
    v.name,
    v.description,
    v.type,
    v.classification,
    ROW_NUMBER() OVER (PARTITION BY u.id, v.classification ORDER BY v."order") AS rn
  FROM "User" u
  CROSS JOIN (VALUES
    ('Pagamento de Fatura', 'Pagamento da fatura do cartão de crédito — não é um gasto novo, apenas a quitação do que já foi lançado nas compras do cartão.', 'NEUTRO', 'NEUTRA', 1),
    ('Reembolso', 'Dinheiro devolvido por alguém ou por uma empresa referente a um gasto que você já fez — não é uma nova receita.', 'NEUTRO', 'NEUTRA', 2),
    ('Transferência entre Contas', 'Movimentações de dinheiro entre suas próprias contas ou carteiras — não representa entrada nem saída real de patrimônio.', 'NEUTRO', 'NEUTRA', 3)
  ) AS v(name, description, type, classification, "order")
  WHERE NOT EXISTS (
    SELECT 1 FROM "Category" c
    WHERE c."userId" = u.id
      AND c.name = v.name
      AND c.type = v.type::"TransactionType"
      AND c.classification = v.classification::"Classification"
  )
) AS ranked;
