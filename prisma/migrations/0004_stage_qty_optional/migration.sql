-- Stage quantity becomes optional: planned days are the yardstick, quantity only when measured.
ALTER TABLE "Stage" ALTER COLUMN "plannedQty" SET DEFAULT 0;
