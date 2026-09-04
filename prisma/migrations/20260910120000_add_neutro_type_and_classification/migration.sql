-- Adds a third, organizational-only Tipo/Classificação pair: NEUTRO
-- (TransactionType) and NEUTRA (Classification), for money movements
-- that are neither real income nor a real expense (a credit-card bill
-- payment, a reimbursement, a transfer between your own accounts).
-- Deliberately excluded from the budget: BUDGET_CLASSIFICATIONS in
-- src/lib/budget-calc.ts is not touched, so it keeps excluding NEUTRA
-- the same way it already excludes RECEITA.
--
-- Postgres allows adding an enum value inside a transaction (since v12),
-- but forbids using that new value within the SAME transaction it was
-- added in — so the category backfill that uses these values lives in
-- its own separate migration (20260910130000) applied afterward.
ALTER TYPE "TransactionType" ADD VALUE 'NEUTRO';
ALTER TYPE "Classification" ADD VALUE 'NEUTRA';
