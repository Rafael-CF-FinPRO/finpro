-- Adds recurring/installment transaction series and a payment-status
-- concept to Transaction. `status` defaults to 'PAGO' so every existing
-- row keeps its current meaning (a real, already-happened movement)
-- with zero backfill needed — only transactions generated ahead of
-- time by a TransactionSeries for a future date are ever created as
-- 'NAO_PAGO'. `externalId` carries the OFX FITID (when present) through
-- to the database for the first time — previously read only to
-- deduplicate rows within a single file parse, then discarded; now
-- used to recognize an exact re-import and, more importantly, as the
-- strongest signal when matching an imported row against a pending
-- series occurrence to reconcile instead of duplicate.
CREATE TYPE "TransactionStatus" AS ENUM ('PAGO', 'NAO_PAGO');

CREATE TYPE "SeriesType" AS ENUM ('RECORRENTE', 'PARCELADO');

CREATE TYPE "RecurrencePeriodicity" AS ENUM ('MENSAL');

ALTER TABLE "Transaction" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'PAGO';

CREATE TABLE "TransactionSeries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesType" "SeriesType" NOT NULL,
    "type" "TransactionType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "classification" "Classification" NOT NULL,
    "description" TEXT,
    "paymentMethodId" TEXT,
    "tagId" TEXT,
    "note" TEXT,
    "amountCents" INTEGER NOT NULL,
    "installmentCount" INTEGER,
    "periodicity" "RecurrencePeriodicity",
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionSeries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionSeries_userId_idx" ON "TransactionSeries"("userId");

CREATE INDEX "Transaction_seriesId_idx" ON "Transaction"("seriesId");

-- Multiple NULLs never conflict in a Postgres unique index, so this
-- only actually constrains rows that do carry a real externalId (OFX
-- imports) — PDF/spreadsheet imports and manual entries keep NULL and
-- are unaffected.
CREATE UNIQUE INDEX "Transaction_userId_externalId_key" ON "Transaction"("userId", "externalId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TransactionSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionSeries" ADD CONSTRAINT "TransactionSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransactionSeries" ADD CONSTRAINT "TransactionSeries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransactionSeries" ADD CONSTRAINT "TransactionSeries_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransactionSeries" ADD CONSTRAINT "TransactionSeries_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same defense-in-depth as Transaction/Category (see
-- 20260901162737_enable_row_level_security): the app connects as
-- table owner and bypasses RLS, so this only closes off the
-- Supabase anon/public API key path — no policy means fully denied
-- for anon/authenticated, matching Transaction (per-user financial
-- data, not safe to expose read-only like Category is).
ALTER TABLE "TransactionSeries" ENABLE ROW LEVEL SECURITY;
