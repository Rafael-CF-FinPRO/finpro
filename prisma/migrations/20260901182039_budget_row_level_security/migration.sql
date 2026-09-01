-- Same rationale as prisma/migrations/20260901162737_enable_row_level_security:
-- the app connects as the table owner (Prisma via DATABASE_URL/DIRECT_URL),
-- which bypasses RLS by default — these policies do NOT restrict the app's
-- own queries (those are, and must remain, scoped by userId in application
-- code). What RLS protects here is the public Supabase anon/publishable key:
-- without it, anyone holding that key could read or write every user's
-- budget data directly through the Supabase REST API. No policies are
-- defined for anon/authenticated, so every operation is denied by default.

ALTER TABLE "BudgetProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetClassificationAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetCategoryAllocation" ENABLE ROW LEVEL SECURITY;
