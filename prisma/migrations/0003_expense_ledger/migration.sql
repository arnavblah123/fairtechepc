-- CreateEnum
CREATE TYPE "PettyCategory" AS ENUM ('LABOUR_FOOD', 'LOCAL_TRANSPORT', 'SMALL_PURCHASE', 'HARDWARE', 'MEDICAL', 'MISC');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('PURCHASE', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('WORKER_CASH', 'COMPANY_DIRECT');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'QUERIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartyKind" AS ENUM ('LABOUR', 'VENDOR', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('ADVANCE', 'TOPUP', 'EXPENSE', 'RETURN', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "PettyTxnType" ADD VALUE 'RETURN';

-- AlterTable
ALTER TABLE "PettyCashTxn" ADD COLUMN     "expenseId" TEXT;
-- Keep existing category values by casting through text rather than dropping
-- and recreating the column, which would blank every past entry.
ALTER TABLE "PettyCashTxn"
  ALTER COLUMN "category" TYPE "PettyCategory"
  USING ("category"::text::"PettyCategory");

-- DropEnum
DROP TYPE "ExpenseCategory";

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiresPerson" BOOLEAN NOT NULL DEFAULT false,
    "requiresMachine" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 500,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "PartyKind" NOT NULL DEFAULT 'VENDOR',
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "entryType" "EntryType" NOT NULL DEFAULT 'PURCHASE',
    "paidFrom" "PaymentSource" NOT NULL DEFAULT 'WORKER_CASH',
    "description" TEXT NOT NULL,
    "note" TEXT,
    "jobId" TEXT,
    "partyId" TEXT,
    "payeeText" TEXT,
    "workerId" TEXT,
    "machineId" TEXT,
    "problem" TEXT,
    "solution" TEXT,
    "billPhotoUrl" TEXT,
    "spentById" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashLedger" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "postingKey" TEXT NOT NULL,
    "expenseId" TEXT,
    "reversesId" TEXT,
    "memo" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_slug_key" ON "ExpenseCategory"("slug");

-- CreateIndex
CREATE INDEX "ExpenseCategory_active_sortOrder_idx" ON "ExpenseCategory"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "Party_siteId_kind_idx" ON "Party"("siteId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Party_siteId_normalizedName_key" ON "Party"("siteId", "normalizedName");

-- CreateIndex
CREATE INDEX "Expense_siteId_status_idx" ON "Expense"("siteId", "status");

-- CreateIndex
CREATE INDEX "Expense_siteId_date_idx" ON "Expense"("siteId", "date");

-- CreateIndex
CREATE INDEX "Expense_spentById_status_idx" ON "Expense"("spentById", "status");

-- CreateIndex
CREATE INDEX "Expense_categoryId_date_idx" ON "Expense"("categoryId", "date");

-- CreateIndex
CREATE INDEX "Expense_machineId_idx" ON "Expense"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "CashLedger_postingKey_key" ON "CashLedger"("postingKey");

-- CreateIndex
CREATE UNIQUE INDEX "CashLedger_reversesId_key" ON "CashLedger"("reversesId");

-- CreateIndex
CREATE INDEX "CashLedger_siteId_holderId_createdAt_idx" ON "CashLedger"("siteId", "holderId", "createdAt");

-- CreateIndex
CREATE INDEX "CashLedger_kind_idx" ON "CashLedger"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashTxn_expenseId_key" ON "PettyCashTxn"("expenseId");

-- AddForeignKey
ALTER TABLE "PettyCashTxn" ADD CONSTRAINT "PettyCashTxn_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_spentById_fkey" FOREIGN KEY ("spentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLedger" ADD CONSTRAINT "CashLedger_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLedger" ADD CONSTRAINT "CashLedger_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLedger" ADD CONSTRAINT "CashLedger_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLedger" ADD CONSTRAINT "CashLedger_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "CashLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLedger" ADD CONSTRAINT "CashLedger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

