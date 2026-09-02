-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'SITE_INCHARGE', 'SUPERVISOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QtyUnit" AS ENUM ('MT', 'NOS', 'METRE', 'SQM');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "Trade" AS ENUM ('FITTER', 'WELDER', 'GRINDER', 'GAS_CUTTER', 'HELPER', 'RIGGER', 'PAINTER');

-- CreateEnum
CREATE TYPE "WageType" AS ENUM ('PER_HOUR', 'PER_DAY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WagePeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "WageSheetStatus" AS ENUM ('DRAFT', 'FINAL', 'PAID');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'URGENT', 'WORK_STOPPED');

-- CreateEnum
CREATE TYPE "PettyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('UPI', 'BANK', 'CASH');

-- CreateEnum
CREATE TYPE "PettyTxnType" AS ENUM ('TOPUP', 'EXPENSE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('LABOUR_FOOD', 'LOCAL_TRANSPORT', 'SMALL_PURCHASE', 'HARDWARE', 'MEDICAL', 'MISC');

-- CreateEnum
CREATE TYPE "MachineType" AS ENUM ('WELDING_MACHINE', 'GRINDER', 'GAS_CUTTING_SET', 'DRILLING_MACHINE', 'CHAIN_PULLEY_BLOCK', 'DG_SET', 'COMPRESSOR', 'OTHER');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('AT_FACTORY', 'RUNNING', 'IDLE', 'UNDER_REPAIR', 'SENT_OUT_FOR_REPAIR', 'RETURNED_TO_FACTORY');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('GOOD', 'AVERAGE', 'NEEDS_REPAIR');

-- CreateEnum
CREATE TYPE "DispatchDirection" AS ENUM ('TO_SITE', 'TO_FACTORY');

-- CreateEnum
CREATE TYPE "RepairType" AS ENUM ('IN_HOUSE', 'SENT_OUT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_REPAIR', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ConsumableCategory" AS ENUM ('WELDING_ELECTRODE', 'MIG_WIRE', 'GAS', 'GRINDING', 'CUTTING', 'HAND_TOOL', 'PPE_SAFETY', 'PAINT', 'HARDWARE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('FROM_FACTORY', 'LOCAL_PURCHASE');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('MATERIAL_SHORTAGE', 'MACHINE_BREAKDOWN', 'MANPOWER_SHORT', 'DRAWING_CLARIFICATION', 'CLIENT_HOLD', 'POWER_WATER', 'SAFETY', 'PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'WORK_STOPPED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DPRStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MISSING');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('DAILY_SLOT', 'MUSTER');

-- CreateEnum
CREATE TYPE "UnlockModule" AS ENUM ('ATTENDANCE', 'CONSUMPTION', 'PHOTOS', 'EXPENSES', 'STAGE_PROGRESS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "siteId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "pettyCashThreshold" DECIMAL(12,2) NOT NULL DEFAULT 5000,
    "dprCutoffHour" INTEGER NOT NULL DEFAULT 20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "description" TEXT,
    "drawingRef" TEXT,
    "plannedTonnage" DECIMAL(12,3) NOT NULL,
    "plannedStart" DATE NOT NULL,
    "plannedEnd" DATE NOT NULL,
    "actualStart" DATE,
    "actualEnd" DATE,
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "weldingNormKgPerMT" DECIMAL(8,3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "QtyUnit" NOT NULL DEFAULT 'MT',
    "plannedQty" DECIMAL(12,3) NOT NULL,
    "plannedDays" INTEGER NOT NULL,
    "actualStart" DATE,
    "actualEnd" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageProgress" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "qtyDone" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "percentComplete" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "StageProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageWorkLog" (
    "id" TEXT NOT NULL,
    "stageProgressId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "Shift" NOT NULL DEFAULT 'DAY',
    "hours" DECIMAL(4,1) NOT NULL DEFAULT 8,

    CONSTRAINT "StageWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "phone" TEXT,
    "trade" "Trade" NOT NULL,
    "joiningDate" DATE NOT NULL,
    "leavingDate" DATE,
    "wageType" "WageType" NOT NULL DEFAULT 'PER_DAY',
    "contractorName" TEXT,
    "idDocRef" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WageRate" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "otRate" DECIMAL(10,2),
    "effectiveFrom" DATE NOT NULL,
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WageRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "inTime" TEXT,
    "outTime" TEXT,
    "otHours" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "remark" TEXT,
    "markedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "wageSheetId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WageSheet" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "period" "WagePeriod" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "daysPresent" DECIMAL(5,1) NOT NULL,
    "hours" DECIMAL(7,1) NOT NULL,
    "otHours" DECIMAL(7,1) NOT NULL,
    "grossWage" DECIMAL(12,2) NOT NULL,
    "advancesDeducted" DECIMAL(12,2) NOT NULL,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "status" "WageSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "WageSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashRequest" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "status" "PettyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentMode" "PaymentMode",
    "sentRef" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "PettyCashRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashTxn" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "PettyTxnType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "ExpenseCategory",
    "description" TEXT NOT NULL,
    "paidTo" TEXT,
    "billPhotoUrl" TEXT,
    "requestId" TEXT,
    "consumableRequestId" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "PettyCashTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashReconciliation" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "physicalCash" DECIMAL(12,2) NOT NULL,
    "appBalance" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PettyCashReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "machineNumber" TEXT NOT NULL,
    "type" "MachineType" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "siteId" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'AT_FACTORY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineDispatch" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "direction" "DispatchDirection" NOT NULL,
    "dispatchDate" DATE NOT NULL,
    "dispatchPhotoUrl" TEXT,
    "conditionOnDispatch" "Condition" NOT NULL,
    "dispatchedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedPhotoUrl" TEXT,
    "conditionOnReceipt" "Condition",
    "receivedById" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "MachineDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineTicket" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "raisedOn" DATE NOT NULL,
    "raisedById" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "repairType" "RepairType",
    "repairedBy" TEXT,
    "repairCost" DECIMAL(12,2),
    "downtimeDays" DECIMAL(5,1),
    "resolvedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "MachineTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineTicketPart" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "MachineTicketPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ConsumableCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "reorderLevel" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "isWeldingConsumable" BOOLEAN NOT NULL DEFAULT false,
    "kgPerUnit" DECIMAL(10,4),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableDispatch" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "dispatchDate" DATE NOT NULL,
    "photoUrl" TEXT,
    "vehicleRef" TEXT,
    "dispatchedById" TEXT NOT NULL,
    "receivedQty" DECIMAL(12,3),
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "shortReceipt" BOOLEAN NOT NULL DEFAULT false,
    "receiptRemark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "ConsumableDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableStock" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyOnHand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumableStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableConsumption" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stageId" TEXT,
    "date" DATE NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "remark" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "ConsumableConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableRequest" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "neededBy" DATE NOT NULL,
    "status" "ConsRequestStatus" NOT NULL DEFAULT 'PENDING',
    "fulfilment" "Fulfilment",
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "purchaseBillUrl" TEXT,
    "purchasePrice" DECIMAL(12,2),
    "purchasedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "ConsumableRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "jobId" TEXT,
    "category" "IssueCategory" NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrl" TEXT,
    "neededFromHO" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "raisedById" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "remark" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "targetQty" DECIMAL(12,3) NOT NULL,
    "manpowerPlanned" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "DailyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DPR" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DPRStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB,
    "remark" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DPR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SitePhoto" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "date" DATE NOT NULL,
    "slot" INTEGER,
    "url" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION NOT NULL,
    "serverTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caption" TEXT,
    "jobId" TEXT,
    "stageId" TEXT,
    "takenById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "SitePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackdateUnlock" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "module" "UnlockModule" NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "unlockedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackdateUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE INDEX "Stage_siteId_idx" ON "Stage"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_jobId_sequence_key" ON "Stage"("jobId", "sequence");

-- CreateIndex
CREATE INDEX "StageProgress_siteId_date_idx" ON "StageProgress"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StageProgress_stageId_date_key" ON "StageProgress"("stageId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StageWorkLog_workerId_date_shift_key" ON "StageWorkLog"("workerId", "date", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_siteId_code_key" ON "Worker"("siteId", "code");

-- CreateIndex
CREATE INDEX "WageRate_workerId_effectiveFrom_idx" ON "WageRate"("workerId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Attendance_siteId_date_idx" ON "Attendance"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_workerId_date_key" ON "Attendance"("workerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_siteId_date_key" ON "Holiday"("siteId", "date");

-- CreateIndex
CREATE INDEX "Advance_siteId_status_idx" ON "Advance"("siteId", "status");

-- CreateIndex
CREATE INDEX "WageSheet_siteId_periodStart_idx" ON "WageSheet"("siteId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "WageSheet_workerId_period_periodStart_key" ON "WageSheet"("workerId", "period", "periodStart");

-- CreateIndex
CREATE INDEX "PettyCashRequest_siteId_status_idx" ON "PettyCashRequest"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashTxn_consumableRequestId_key" ON "PettyCashTxn"("consumableRequestId");

-- CreateIndex
CREATE INDEX "PettyCashTxn_siteId_date_idx" ON "PettyCashTxn"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashReconciliation_siteId_month_key" ON "PettyCashReconciliation"("siteId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineNumber_key" ON "Machine"("machineNumber");

-- CreateIndex
CREATE INDEX "MachineDispatch_siteId_dispatchDate_idx" ON "MachineDispatch"("siteId", "dispatchDate");

-- CreateIndex
CREATE INDEX "MachineTicket_siteId_status_idx" ON "MachineTicket"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumableItem_name_key" ON "ConsumableItem"("name");

-- CreateIndex
CREATE INDEX "ConsumableDispatch_siteId_dispatchDate_idx" ON "ConsumableDispatch"("siteId", "dispatchDate");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumableStock_siteId_itemId_key" ON "ConsumableStock"("siteId", "itemId");

-- CreateIndex
CREATE INDEX "ConsumableConsumption_siteId_date_idx" ON "ConsumableConsumption"("siteId", "date");

-- CreateIndex
CREATE INDEX "ConsumableConsumption_jobId_idx" ON "ConsumableConsumption"("jobId");

-- CreateIndex
CREATE INDEX "ConsumableRequest_siteId_status_idx" ON "ConsumableRequest"("siteId", "status");

-- CreateIndex
CREATE INDEX "Issue_siteId_status_severity_idx" ON "Issue"("siteId", "status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlan_siteId_date_key" ON "DailyPlan"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DPR_siteId_date_key" ON "DPR"("siteId", "date");

-- CreateIndex
CREATE INDEX "SitePhoto_siteId_date_idx" ON "SitePhoto"("siteId", "date");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_siteId_createdAt_idx" ON "AuditLog"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "BackdateUnlock_siteId_module_date_idx" ON "BackdateUnlock"("siteId", "module", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgress" ADD CONSTRAINT "StageProgress_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgress" ADD CONSTRAINT "StageProgress_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgress" ADD CONSTRAINT "StageProgress_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgress" ADD CONSTRAINT "StageProgress_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageWorkLog" ADD CONSTRAINT "StageWorkLog_stageProgressId_fkey" FOREIGN KEY ("stageProgressId") REFERENCES "StageProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageWorkLog" ADD CONSTRAINT "StageWorkLog_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WageRate" ADD CONSTRAINT "WageRate_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WageRate" ADD CONSTRAINT "WageRate_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_wageSheetId_fkey" FOREIGN KEY ("wageSheetId") REFERENCES "WageSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WageSheet" ADD CONSTRAINT "WageSheet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WageSheet" ADD CONSTRAINT "WageSheet_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WageSheet" ADD CONSTRAINT "WageSheet_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashRequest" ADD CONSTRAINT "PettyCashRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashRequest" ADD CONSTRAINT "PettyCashRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashRequest" ADD CONSTRAINT "PettyCashRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTxn" ADD CONSTRAINT "PettyCashTxn_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTxn" ADD CONSTRAINT "PettyCashTxn_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PettyCashRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTxn" ADD CONSTRAINT "PettyCashTxn_consumableRequestId_fkey" FOREIGN KEY ("consumableRequestId") REFERENCES "ConsumableRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTxn" ADD CONSTRAINT "PettyCashTxn_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashReconciliation" ADD CONSTRAINT "PettyCashReconciliation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashReconciliation" ADD CONSTRAINT "PettyCashReconciliation_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDispatch" ADD CONSTRAINT "MachineDispatch_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDispatch" ADD CONSTRAINT "MachineDispatch_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDispatch" ADD CONSTRAINT "MachineDispatch_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDispatch" ADD CONSTRAINT "MachineDispatch_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTicket" ADD CONSTRAINT "MachineTicket_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTicket" ADD CONSTRAINT "MachineTicket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTicket" ADD CONSTRAINT "MachineTicket_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTicket" ADD CONSTRAINT "MachineTicket_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTicketPart" ADD CONSTRAINT "MachineTicketPart_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MachineTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableDispatch" ADD CONSTRAINT "ConsumableDispatch_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableDispatch" ADD CONSTRAINT "ConsumableDispatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConsumableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableDispatch" ADD CONSTRAINT "ConsumableDispatch_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableDispatch" ADD CONSTRAINT "ConsumableDispatch_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableStock" ADD CONSTRAINT "ConsumableStock_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableStock" ADD CONSTRAINT "ConsumableStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConsumableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableConsumption" ADD CONSTRAINT "ConsumableConsumption_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableConsumption" ADD CONSTRAINT "ConsumableConsumption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConsumableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableConsumption" ADD CONSTRAINT "ConsumableConsumption_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableConsumption" ADD CONSTRAINT "ConsumableConsumption_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableConsumption" ADD CONSTRAINT "ConsumableConsumption_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRequest" ADD CONSTRAINT "ConsumableRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRequest" ADD CONSTRAINT "ConsumableRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConsumableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRequest" ADD CONSTRAINT "ConsumableRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableRequest" ADD CONSTRAINT "ConsumableRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlan" ADD CONSTRAINT "DailyPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlan" ADD CONSTRAINT "DailyPlan_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlanItem" ADD CONSTRAINT "DailyPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DailyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlanItem" ADD CONSTRAINT "DailyPlanItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlanItem" ADD CONSTRAINT "DailyPlanItem_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DPR" ADD CONSTRAINT "DPR_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DPR" ADD CONSTRAINT "DPR_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePhoto" ADD CONSTRAINT "SitePhoto_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackdateUnlock" ADD CONSTRAINT "BackdateUnlock_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackdateUnlock" ADD CONSTRAINT "BackdateUnlock_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

