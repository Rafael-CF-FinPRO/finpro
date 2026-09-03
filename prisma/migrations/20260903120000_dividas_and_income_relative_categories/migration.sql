-- Orçamento structural correction:
--   1. Replaces the "Financiamentos" classification with "Dívidas" —
--      "Financiamento" becomes a Category inside Dívidas, not its own
--      Classification.
--   2. Fixes category names left over from an earlier restructuring pass
--      that never got corrected to match the official (spreadsheet-
--      derived) category list.
--   3. Converts every existing BudgetCategoryAllocation percentage from
--      "% of its Classification's budgeted amount" to "% of total
--      income" (see the new formula in AGENTS.md / src/lib/budget.ts):
--      a Category's value is now `renda × percentual_categoria / 100`
--      directly, never `renda × percentual_classificação ×
--      percentual_categoria`.
--
-- No Transaction or Category row is deleted, and no
-- amountCents/date/userId/description/categoryId changes anywhere —
-- only classification labels, category names, and
-- BudgetCategoryAllocation.percentage values are corrected.
--
-- Two existing categories have no unambiguous match in the new
-- canonical list and are intentionally left untouched, per "quando não
-- houver correspondência clara, não invente um mapeamento":
--   - "Contas e Utilidades" (Essenciais) — no single canonical category
--     it clearly corresponds to.
--   - "Investimentos" (Investimentos, inactive) — could equally be
--     "Carteira de Investimentos" or "Outros Investimentos"; guessing
--     between the two would be inventing a mapping.
-- "Teste" (Essenciais, inactive) is left untouched too — it was created
-- directly by a real user through the app, not by any seed/default
-- list, so it isn't in scope for this cleanup at all.

-- 1. Classification rename. This is a plain enum-value rename, not a
--    type rebuild: the set of allowed values doesn't change size, only
--    this one label's spelling — every row that already had
--    classification = 'FINANCIAMENTOS' keeps pointing at the exact same
--    underlying value, now spelled 'DIVIDAS'.
ALTER TYPE "Classification" RENAME VALUE 'FINANCIAMENTOS' TO 'DIVIDAS';

-- 2. Category name corrections (same real-world concept, wrong label).
UPDATE "Category" SET name = 'Mercado' WHERE name = 'Supermercado' AND type = 'SAIDA';
UPDATE "Category" SET name = 'Essenciais Geral' WHERE name = 'Outras Despesas' AND classification = 'ESSENCIAIS';
UPDATE "Category" SET name = 'Lazer e Diversão' WHERE name = 'Lazer' AND classification = 'NAO_ESSENCIAIS';
UPDATE "Category" SET name = 'Roupas e Vestuário' WHERE name = 'Vestuário' AND classification = 'NAO_ESSENCIAIS';

-- 3. "Transporte" and "Pets" exist once per Classification (Essenciais /
--    Não Essenciais) for the same user — the naming rule requires the
--    Classification spelled out in the name itself so the two never
--    look identical in a flat list (e.g. the Lançamentos category
--    picker). Only "Transporte - Essencial" needs fixing here — no user
--    currently has a "Transporte" row under Não Essenciais.
UPDATE "Category" SET name = 'Transporte - Essencial' WHERE name = 'Transporte' AND classification = 'ESSENCIAIS';
UPDATE "Category" SET name = 'Pets - Essencial' WHERE name = 'Pets' AND classification = 'ESSENCIAIS';
UPDATE "Category" SET name = 'Pets - Não Essencial' WHERE name = 'Pets' AND classification = 'NAO_ESSENCIAIS';

-- 4. Convert BudgetCategoryAllocation.percentage from "% of
--    classification" to "% of income", preserving the exact real-money
--    budget already configured: new_pct = round(old_pct ×
--    classification_pct / 100), using the largest-remainder method
--    within each classification so the converted categories still sum
--    to exactly that classification's percentage (independent
--    per-row rounding could drift the total by a couple of points).
--    Only one profile (a dev/test account, budgetProfileId
--    cmtj05xiv00001su1fgnqj3bo, monthKey 'default') has any category
--    allocations at all; Dívidas/Investimentos had none to convert.
--
--    Essenciais (classification percentage: 55) — old percentages
--    30/20/10/15/10/10/5 (sum 100) become 17/11/6/8/5/5/3 (sum 55):
UPDATE "BudgetCategoryAllocation" SET percentage = 17 WHERE id = 'cmtkcsylm000x8ou1sjayt1mt'; -- Moradia: 30 -> 17
UPDATE "BudgetCategoryAllocation" SET percentage = 11 WHERE id = 'cmtkcsylm000y8ou1ljqzdhra'; -- Contas e Utilidades: 20 -> 11
UPDATE "BudgetCategoryAllocation" SET percentage = 6  WHERE id = 'cmtkcsylm000z8ou1hjxr7v16'; -- Educação: 10 -> 6
UPDATE "BudgetCategoryAllocation" SET percentage = 8  WHERE id = 'cmtkcsylm00108ou1j9h6huq4'; -- Mercado (was Supermercado): 15 -> 8
UPDATE "BudgetCategoryAllocation" SET percentage = 5  WHERE id = 'cmtkcsylm00118ou1xwj5v9ag'; -- Transporte - Essencial: 10 -> 5
UPDATE "BudgetCategoryAllocation" SET percentage = 5  WHERE id = 'cmtkcsylm00128ou18oof2ua1'; -- Saúde: 10 -> 5
UPDATE "BudgetCategoryAllocation" SET percentage = 3  WHERE id = 'cmtkcsylm00138ou1f5p9gfh6'; -- Essenciais Geral (was Outras Despesas): 5 -> 3

--    Não Essenciais (classification percentage: 20) — old percentages
--    40/40/20 (sum 100) become 8/8/4 (sum 20), no rounding drift:
UPDATE "BudgetCategoryAllocation" SET percentage = 8 WHERE id = 'cmtkcsylm00148ou15bcq3u1m'; -- Assinaturas: 40 -> 8
UPDATE "BudgetCategoryAllocation" SET percentage = 8 WHERE id = 'cmtkcsylm00158ou1b74vwad9'; -- Lazer e Diversão (was Lazer): 40 -> 8
UPDATE "BudgetCategoryAllocation" SET percentage = 4 WHERE id = 'cmtkcsylm00168ou1cywif61s'; -- Roupas e Vestuário (was Vestuário): 20 -> 4
