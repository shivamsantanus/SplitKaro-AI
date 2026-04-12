CREATE TABLE "PersonalTransaction" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "PersonalTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonalTransaction_ownerId_transactionDate_idx" ON "PersonalTransaction"("ownerId", "transactionDate");
CREATE INDEX "PersonalTransaction_ownerId_category_idx" ON "PersonalTransaction"("ownerId", "category");

ALTER TABLE "PersonalTransaction"
ADD CONSTRAINT "PersonalTransaction_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
