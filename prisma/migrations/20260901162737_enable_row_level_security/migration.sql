-- Enable Row Level Security on user-facing tables.
--
-- IMPORTANT: the application connects to Postgres as the Supabase
-- "postgres" role (table owner), and table owners bypass RLS by
-- default. So these policies do NOT restrict the app's own Prisma
-- queries — those are, and must remain, scoped by `userId` in
-- application code (every query in src/app/actions/transactions.ts
-- and src/lib/transactions.ts filters by the authenticated user's id).
--
-- What RLS *does* protect here: the Supabase anon/public API key
-- (NEXT_PUBLIC_SUPABASE_ANON_KEY) is shipped to the browser. Without
-- RLS, anyone holding that key could call the Supabase REST API
-- directly and read or write every user's transactions, bypassing
-- this app entirely. Enabling RLS with no permissive policy for the
-- anon/authenticated roles denies that path completely, as
-- defense-in-depth on top of the application-level checks.

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;

-- "Transaction" has no policies for anon/authenticated: every request
-- through the Supabase REST/anon-key path is denied by default,
-- for every operation (select/insert/update/delete).

-- "Category" is shared, non-sensitive reference data (not
-- user-specific), so it's safe to expose read-only via the anon key.
CREATE POLICY "Public read access to categories"
  ON "Category"
  FOR SELECT
  TO anon, authenticated
  USING (true);
