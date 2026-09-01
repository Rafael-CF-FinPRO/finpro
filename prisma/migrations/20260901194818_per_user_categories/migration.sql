-- Categories move from a single global shared list to per-user, editable
-- rows (name, classification, active/inactive) — Classification itself
-- stays a fixed system enum, untouched by this migration.
--
-- Every existing category is cloned once per existing user, and every
-- Transaction / BudgetCategoryAllocation that referenced the old shared
-- row is repointed to that user's own clone — no amount/date/user/
-- description is touched, and no row is deleted except the now-orphaned
-- shared category rows themselves once nothing references them.

-- 1. Add the new columns (userId nullable for now, filled in below).
ALTER TABLE "Category" ADD COLUMN "userId" TEXT;
ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 2. Drop the old *global* (name, type) uniqueness now, before inserting
--    per-user clones — otherwise cloning "Salário"/ENTRADA for a second
--    user collides with the first user's clone under the old constraint.
DROP INDEX "Category_name_type_key";

-- 3. Build a temporary old-category -> per-user-clone id map.
CREATE TEMPORARY TABLE "_category_clone_map" (
  old_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  new_id TEXT NOT NULL
);

INSERT INTO "_category_clone_map" (old_id, user_id, new_id)
SELECT c.id, u.id, gen_random_uuid()::text
FROM "Category" c
CROSS JOIN "User" u
WHERE c."userId" IS NULL;

-- 4. Create the per-user clones.
INSERT INTO "Category" (id, "userId", name, type, classification, "order", "isActive", "createdAt")
SELECT m.new_id, m.user_id, c.name, c.type, c.classification, c."order", true, c."createdAt"
FROM "_category_clone_map" m
JOIN "Category" c ON c.id = m.old_id;

-- 5. Repoint Transaction rows to their owner's own clone.
UPDATE "Transaction" t
SET "categoryId" = m.new_id
FROM "_category_clone_map" m
WHERE t."categoryId" = m.old_id AND t."userId" = m.user_id;

-- 6. Repoint BudgetCategoryAllocation rows (via the owning BudgetProfile).
--    (bp is joined against the clone map, not against the UPDATE target —
--    Postgres doesn't allow the target table in a FROM-list JOIN's ON
--    clause, only in WHERE.)
UPDATE "BudgetCategoryAllocation" bca
SET "categoryId" = m.new_id
FROM "_category_clone_map" m, "BudgetProfile" bp
WHERE bp."userId" = m.user_id
  AND bca."budgetProfileId" = bp.id
  AND bca."categoryId" = m.old_id;

-- 7. Drop the now-unreferenced shared category rows.
DELETE FROM "Category" WHERE "userId" IS NULL;

DROP TABLE "_category_clone_map";

-- 8. Finish the column: required, indexed, foreign key.
ALTER TABLE "Category" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Category"
  ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- 9. Final per-user uniqueness (replaces the old global one dropped in step 2).
CREATE UNIQUE INDEX "Category_userId_name_type_key" ON "Category"("userId", name, type);

-- 10. Categories are no longer shared reference data readable by anyone —
--     drop the public read policy from the RLS migration that made sense
--     when they were global; per-user category rows must not be readable
--     through the anon/publishable key at all (same deny-by-default as
--     every other user-owned table).
DROP POLICY IF EXISTS "Public read access to categories" ON "Category";
