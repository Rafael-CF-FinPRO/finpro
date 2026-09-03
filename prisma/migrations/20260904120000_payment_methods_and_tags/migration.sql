-- Adds "Meio de Pagamento" (PaymentMethod) and "Tag" — optional,
-- per-user, structured metadata on Transaction. Both are lighter-weight
-- than Category: no classification, no soft-delete/isActive. A real
-- DELETE is allowed from Configurações and just clears the label from
-- any historical transaction via ON DELETE SET NULL — it never touches
-- amount/date/description/category, so no financial history is lost.

CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethod_userId_name_key" ON "PaymentMethod"("userId", "name");
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");

ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "tagId" TEXT;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: same rationale as every other user-owned table in this project —
-- the app connects as the table owner (bypasses RLS), so these policies
-- don't restrict the app's own queries (those are, and must remain,
-- scoped by userId in application code). What RLS protects here is the
-- public Supabase anon/publishable key: without it, anyone holding that
-- key could read or write this data directly through the Supabase REST
-- API. No policies are defined for anon/authenticated, so every
-- operation is denied by default.
ALTER TABLE "PaymentMethod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
