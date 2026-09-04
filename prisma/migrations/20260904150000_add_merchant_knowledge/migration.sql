-- Global (cross-user) merchant -> category knowledge base for the
-- on-demand import categorizer. No userId, no categoryId — stores the
-- canonical category identity (name + type + classification) since
-- Category itself is per-user; resolved against each user's own
-- matching category at lookup time. See src/lib/import/merchant-resolver.ts.
CREATE TABLE "MerchantKnowledge" (
    "id" TEXT NOT NULL,
    "normalizedPattern" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "categoryType" "TransactionType" NOT NULL,
    "categoryClassification" "Classification" NOT NULL,
    "sampleDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantKnowledge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantKnowledge_normalizedPattern_key" ON "MerchantKnowledge"("normalizedPattern");

-- Same defense-in-depth as Transaction/TransactionSeries (see
-- 20260901162737_enable_row_level_security): the app connects as table
-- owner and bypasses RLS, so this only closes the Supabase
-- anon/public API key path. No policy — fully denied for
-- anon/authenticated, even though the data itself isn't per-user
-- sensitive, there's no legitimate reason to expose it that way.
ALTER TABLE "MerchantKnowledge" ENABLE ROW LEVEL SECURITY;
