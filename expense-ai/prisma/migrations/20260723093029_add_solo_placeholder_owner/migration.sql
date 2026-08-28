-- AlterTable
ALTER TABLE "User" ADD COLUMN     "placeholderOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "User_placeholderOwnerId_idx" ON "User"("placeholderOwnerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_placeholderOwnerId_fkey" FOREIGN KEY ("placeholderOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
