-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placeholderGroupId" TEXT;

-- CreateIndex
CREATE INDEX "User_placeholderGroupId_idx" ON "User"("placeholderGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_placeholderGroupId_fkey" FOREIGN KEY ("placeholderGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
