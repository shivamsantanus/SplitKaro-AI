-- AlterTable: add transactionDate to Expense
-- Existing rows get CURRENT_TIMESTAMP as their transactionDate (safe, no data loss)
ALTER TABLE "Expense" ADD COLUMN "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropIndex: replace old groupId+createdAt index with groupId+transactionDate
DROP INDEX "Expense_groupId_createdAt_idx";

-- CreateIndex
CREATE INDEX "Expense_groupId_transactionDate_idx" ON "Expense"("groupId", "transactionDate");
