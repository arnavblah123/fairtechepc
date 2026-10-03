-- Stages describe what will be done; quantity targets are no longer entered.
ALTER TABLE "Stage" ADD COLUMN "scope" TEXT;
