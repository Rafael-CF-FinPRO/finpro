-- Descrição becomes optional: the create/edit transaction form no longer
-- requires it, falling back to the category name for display when absent.
ALTER TABLE "Transaction" ALTER COLUMN "description" DROP NOT NULL;
