-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "groupId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "groupId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" ALTER COLUMN "groupId" DROP NOT NULL;
