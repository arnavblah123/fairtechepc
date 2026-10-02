-- AlterTable
ALTER TABLE "ConsumableRequest" ADD COLUMN     "indentId" TEXT,
ADD COLUMN     "vendorPartyId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "billId" TEXT;

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "partyId" TEXT,
    "payeeText" TEXT,
    "billNo" TEXT,
    "billPhotoUrl" TEXT,
    "paidFrom" "PaymentSource" NOT NULL DEFAULT 'WORKER_CASH',
    "note" TEXT,
    "spentById" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIndent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "indentNo" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "neededBy" DATE NOT NULL,
    "note" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "MaterialIndent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bill_siteId_date_idx" ON "Bill"("siteId", "date");

-- CreateIndex
CREATE INDEX "Bill_partyId_idx" ON "Bill"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialIndent_indentNo_key" ON "MaterialIndent"("indentNo");

-- CreateIndex
CREATE INDEX "MaterialIndent_siteId_requestedAt_idx" ON "MaterialIndent"("siteId", "requestedAt");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_spentById_fkey" FOREIGN KEY ("spentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIndent" ADD CONSTRAINT "MaterialIndent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIndent" ADD CONSTRAINT "MaterialIndent_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRequest" ADD CONSTRAINT "ConsumableRequest_indentId_fkey" FOREIGN KEY ("indentId") REFERENCES "MaterialIndent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRequest" ADD CONSTRAINT "ConsumableRequest_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

