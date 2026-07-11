-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME');

-- AlterTable
ALTER TABLE "PersonalTransaction" ADD COLUMN     "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE';

-- CreateIndex
CREATE INDEX "PersonalTransaction_ownerId_type_transactionDate_idx" ON "PersonalTransaction"("ownerId", "type", "transactionDate");
