-- Gestão Patrimonial — a self-contained module, entirely new tables,
-- no existing table touched.
CREATE TYPE "PatrimonioAssetCategory" AS ENUM ('FINANCEIRO', 'BEM_MOVEL', 'BEM_IMOVEL', 'INTANGIVEL', 'COLECIONAVEL');

CREATE TYPE "PatrimonioLiabilityCategory" AS ENUM ('EMPRESTIMO_DIVIDA', 'FINANCIAMENTO', 'CONSORCIO', 'OUTRO');

CREATE TYPE "PatrimonioUsageType" AS ENUM ('USO_PESSOAL', 'GERADOR_RENDA');

CREATE TYPE "PatrimonioLocation" AS ENUM ('ONSHORE', 'OFFSHORE');

CREATE TYPE "PatrimonioLiquidity" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

CREATE TYPE "PatrimonioUpdateMethod" AS ENUM ('MANUAL', 'PROJECAO_AUTOMATICA');

CREATE TABLE "PatrimonioAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "PatrimonioAssetCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "currentValueCents" INTEGER NOT NULL,
    "usageType" "PatrimonioUsageType",
    "location" "PatrimonioLocation",
    "liquidity" "PatrimonioLiquidity",
    "updateMethod" "PatrimonioUpdateMethod" NOT NULL DEFAULT 'MANUAL',
    "annualRatePct" DOUBLE PRECISION,
    "rateLabel" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseValueCents" INTEGER,
    "isRented" BOOLEAN,
    "rentNetValueCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrimonioAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatrimonioAsset_userId_category_idx" ON "PatrimonioAsset"("userId", "category");

ALTER TABLE "PatrimonioAsset" ADD CONSTRAINT "PatrimonioAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PatrimonioLiability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "PatrimonioLiabilityCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "currentBalanceCents" INTEGER NOT NULL,
    "installmentValueCents" INTEGER,
    "remainingInstallments" INTEGER,
    "amortization" TEXT,
    "cetPct" DOUBLE PRECISION,
    "correctionIndex" TEXT,
    "administrationFeePct" DOUBLE PRECISION,
    "creditValueCents" INTEGER,
    "liabilityType" TEXT,
    "linkedAssetId" TEXT,
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrimonioLiability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatrimonioLiability_userId_category_idx" ON "PatrimonioLiability"("userId", "category");

CREATE INDEX "PatrimonioLiability_linkedAssetId_idx" ON "PatrimonioLiability"("linkedAssetId");

ALTER TABLE "PatrimonioLiability" ADD CONSTRAINT "PatrimonioLiability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatrimonioLiability" ADD CONSTRAINT "PatrimonioLiability_linkedAssetId_fkey" FOREIGN KEY ("linkedAssetId") REFERENCES "PatrimonioAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PatrimonioProtection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "objective" TEXT,
    "currentValueCents" INTEGER,
    "idealValueCents" INTEGER,
    "isNeeded" BOOLEAN,
    "isCovered" BOOLEAN,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrimonioProtection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatrimonioProtection_userId_idx" ON "PatrimonioProtection"("userId");

ALTER TABLE "PatrimonioProtection" ADD CONSTRAINT "PatrimonioProtection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PatrimonioMonthlyConfirmation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "assetId" TEXT,
    "liabilityId" TEXT,
    "valueCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrimonioMonthlyConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatrimonioMonthlyConfirmation_assetId_monthKey_key" ON "PatrimonioMonthlyConfirmation"("assetId", "monthKey");

CREATE UNIQUE INDEX "PatrimonioMonthlyConfirmation_liabilityId_monthKey_key" ON "PatrimonioMonthlyConfirmation"("liabilityId", "monthKey");

CREATE INDEX "PatrimonioMonthlyConfirmation_userId_monthKey_idx" ON "PatrimonioMonthlyConfirmation"("userId", "monthKey");

ALTER TABLE "PatrimonioMonthlyConfirmation" ADD CONSTRAINT "PatrimonioMonthlyConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatrimonioMonthlyConfirmation" ADD CONSTRAINT "PatrimonioMonthlyConfirmation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PatrimonioAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatrimonioMonthlyConfirmation" ADD CONSTRAINT "PatrimonioMonthlyConfirmation_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PatrimonioLiability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
