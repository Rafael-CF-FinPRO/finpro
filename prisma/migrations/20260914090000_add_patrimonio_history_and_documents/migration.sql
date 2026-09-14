-- Gestão Patrimonial: value-change history + optional single-document
-- attachments on Passivos/Proteção + two Consórcio-specific columns.
-- Purely additive — no existing column is altered or dropped.

ALTER TABLE "PatrimonioLiability" ADD COLUMN "isContemplated" BOOLEAN;
ALTER TABLE "PatrimonioLiability" ADD COLUMN "contemplationDate" TIMESTAMP(3);
ALTER TABLE "PatrimonioLiability" ADD COLUMN "documentFileName" TEXT;
ALTER TABLE "PatrimonioLiability" ADD COLUMN "documentMimeType" TEXT;
ALTER TABLE "PatrimonioLiability" ADD COLUMN "documentFileSize" INTEGER;
ALTER TABLE "PatrimonioLiability" ADD COLUMN "documentData" BYTEA;

ALTER TABLE "PatrimonioProtection" ADD COLUMN "documentFileName" TEXT;
ALTER TABLE "PatrimonioProtection" ADD COLUMN "documentMimeType" TEXT;
ALTER TABLE "PatrimonioProtection" ADD COLUMN "documentFileSize" INTEGER;
ALTER TABLE "PatrimonioProtection" ADD COLUMN "documentData" BYTEA;

CREATE TYPE "PatrimonioValueChangeOrigin" AS ENUM ('MANUAL', 'AUTOMATICA', 'PROJETADA', 'CONFIRMADA_MANUALMENTE');

CREATE TABLE "PatrimonioValueChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT,
    "liabilityId" TEXT,
    "previousValueCents" INTEGER NOT NULL,
    "newValueCents" INTEGER NOT NULL,
    "origin" "PatrimonioValueChangeOrigin" NOT NULL DEFAULT 'MANUAL',
    "changedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatrimonioValueChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatrimonioValueChange_userId_idx" ON "PatrimonioValueChange"("userId");

CREATE INDEX "PatrimonioValueChange_assetId_idx" ON "PatrimonioValueChange"("assetId");

CREATE INDEX "PatrimonioValueChange_liabilityId_idx" ON "PatrimonioValueChange"("liabilityId");

ALTER TABLE "PatrimonioValueChange" ADD CONSTRAINT "PatrimonioValueChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatrimonioValueChange" ADD CONSTRAINT "PatrimonioValueChange_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "PatrimonioAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatrimonioValueChange" ADD CONSTRAINT "PatrimonioValueChange_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PatrimonioLiability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
