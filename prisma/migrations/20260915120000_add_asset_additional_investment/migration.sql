-- Bens Imóveis: "Investimentos Adicionais" — purely additive, nullable,
-- no existing column altered or dropped. Existing rows get NULL,
-- treated as zero everywhere it's used (never requires backfill).

ALTER TABLE "PatrimonioAsset" ADD COLUMN "additionalInvestmentCents" INTEGER;
