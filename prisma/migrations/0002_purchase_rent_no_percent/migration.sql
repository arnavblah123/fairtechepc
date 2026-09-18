-- CreateEnum
CREATE TYPE "Ownership" AS ENUM ('OWNED', 'RENTED');

-- AlterEnum
ALTER TYPE "ConsRequestStatus" ADD VALUE 'ORDERED';

-- AlterEnum
ALTER TYPE "Fulfilment" ADD VALUE 'PURCHASE_ORDER';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PURCHASE';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConsumableDispatch" ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "ConsumableRequest" ADD COLUMN     "expectedDate" DATE,
ADD COLUMN     "orderNote" TEXT,
ADD COLUMN     "orderedAt" TIMESTAMP(3),
ADD COLUMN     "orderedById" TEXT,
ADD COLUMN     "poNumber" TEXT,
ADD COLUMN     "unitPrice" DECIMAL(12,2),
ADD COLUMN     "vendorName" TEXT;

-- AlterTable
ALTER TABLE "DPR" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DailyPlan" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "plannedTonnage" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "ownership" "Ownership" NOT NULL DEFAULT 'OWNED',
ADD COLUMN     "rentFrom" DATE,
ADD COLUMN     "rentPerMonth" DECIMAL(12,2),
ADD COLUMN     "rentTo" DATE,
ADD COLUMN     "rentVendor" TEXT;

-- AlterTable
ALTER TABLE "StageProgress" DROP COLUMN "percentComplete";

-- CreateTable
CREATE TABLE "JobMaterial" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "plannedQty" DECIMAL(12,3) NOT NULL,
    "note" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "JobMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobMaterial_siteId_idx" ON "JobMaterial"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "JobMaterial_jobId_itemId_key" ON "JobMaterial"("jobId", "itemId");

-- AddForeignKey
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConsumableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableDispatch" ADD CONSTRAINT "ConsumableDispatch_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ConsumableRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRequest" ADD CONSTRAINT "ConsumableRequest_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

