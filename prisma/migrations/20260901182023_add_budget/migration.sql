-- CreateTable
CREATE TABLE "BudgetProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyIncomeCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetClassificationAllocation" (
    "id" TEXT NOT NULL,
    "budgetProfileId" TEXT NOT NULL,
    "classification" "Classification" NOT NULL,
    "percentage" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetClassificationAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCategoryAllocation" (
    "id" TEXT NOT NULL,
    "budgetProfileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCategoryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetProfile_userId_key" ON "BudgetProfile"("userId");

-- CreateIndex
CREATE INDEX "BudgetClassificationAllocation_budgetProfileId_monthKey_idx" ON "BudgetClassificationAllocation"("budgetProfileId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetClassificationAllocation_budgetProfileId_classificati_key" ON "BudgetClassificationAllocation"("budgetProfileId", "classification", "monthKey");

-- CreateIndex
CREATE INDEX "BudgetCategoryAllocation_budgetProfileId_monthKey_idx" ON "BudgetCategoryAllocation"("budgetProfileId", "monthKey");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategoryAllocation_budgetProfileId_categoryId_monthKe_key" ON "BudgetCategoryAllocation"("budgetProfileId", "categoryId", "monthKey");

-- AddForeignKey
ALTER TABLE "BudgetProfile" ADD CONSTRAINT "BudgetProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetClassificationAllocation" ADD CONSTRAINT "BudgetClassificationAllocation_budgetProfileId_fkey" FOREIGN KEY ("budgetProfileId") REFERENCES "BudgetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCategoryAllocation" ADD CONSTRAINT "BudgetCategoryAllocation_budgetProfileId_fkey" FOREIGN KEY ("budgetProfileId") REFERENCES "BudgetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCategoryAllocation" ADD CONSTRAINT "BudgetCategoryAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
