-- AlterTable
ALTER TABLE "User" ADD COLUMN "whatsappPhone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappPhone_key" ON "User"("whatsappPhone");
