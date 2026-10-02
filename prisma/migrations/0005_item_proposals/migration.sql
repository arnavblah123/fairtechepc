-- AlterTable
ALTER TABLE "ConsumableItem" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "proposedById" TEXT;

-- AddForeignKey
ALTER TABLE "ConsumableItem" ADD CONSTRAINT "ConsumableItem_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

