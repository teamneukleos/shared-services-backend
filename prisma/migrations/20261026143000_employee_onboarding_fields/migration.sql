-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- AlterTable OnboardingPlan: add new columns as nullable for safe backfill
ALTER TABLE "OnboardingPlan"
ADD COLUMN "notes" TEXT,
ADD COLUMN "targetCompletionDate" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "coordinatorUserId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill timestamps for legacy rows
UPDATE "OnboardingPlan"
SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "OnboardingPlan"
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- Convert OnboardingPlan.status from free text to OnboardingStatus
ALTER TABLE "OnboardingPlan"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "OnboardingPlan"
ALTER COLUMN "status" TYPE "OnboardingStatus"
USING (
  CASE upper(trim("status"))
    WHEN 'NOT_STARTED' THEN 'NOT_STARTED'::"OnboardingStatus"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"OnboardingStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"OnboardingStatus"
    WHEN 'CANCELLED' THEN 'CANCELLED'::"OnboardingStatus"
    WHEN 'CANCELED' THEN 'CANCELLED'::"OnboardingStatus"
    WHEN 'DONE' THEN 'COMPLETED'::"OnboardingStatus"
    WHEN 'ACTIVE' THEN 'IN_PROGRESS'::"OnboardingStatus"
    ELSE 'NOT_STARTED'::"OnboardingStatus"
  END
);

ALTER TABLE "OnboardingPlan"
ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED'::"OnboardingStatus";

-- Set completedAt for already-completed legacy plans when missing
UPDATE "OnboardingPlan"
SET "completedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'COMPLETED'
  AND "completedAt" IS NULL;

-- AlterTable OnboardingTask
ALTER TABLE "OnboardingTask"
ADD COLUMN "description" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "isRequired" BOOLEAN,
ADD COLUMN "assigneeUserId" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "completedByUserId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Migrate ownerUserId → assigneeUserId
UPDATE "OnboardingTask"
SET "assigneeUserId" = "ownerUserId"
WHERE "ownerUserId" IS NOT NULL
  AND "assigneeUserId" IS NULL;

ALTER TABLE "OnboardingTask" DROP COLUMN IF EXISTS "ownerUserId";

UPDATE "OnboardingTask"
SET "isRequired" = TRUE
WHERE "isRequired" IS NULL;

UPDATE "OnboardingTask"
SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "OnboardingTask"
ALTER COLUMN "isRequired" SET NOT NULL,
ALTER COLUMN "isRequired" SET DEFAULT TRUE,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- Convert OnboardingTask.status from free text to OnboardingTaskStatus
ALTER TABLE "OnboardingTask"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "OnboardingTask"
ALTER COLUMN "status" TYPE "OnboardingTaskStatus"
USING (
  CASE upper(trim("status"))
    WHEN 'PENDING' THEN 'PENDING'::"OnboardingTaskStatus"
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"OnboardingTaskStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"OnboardingTaskStatus"
    WHEN 'SKIPPED' THEN 'SKIPPED'::"OnboardingTaskStatus"
    WHEN 'DONE' THEN 'COMPLETED'::"OnboardingTaskStatus"
    WHEN 'TODO' THEN 'PENDING'::"OnboardingTaskStatus"
    ELSE 'PENDING'::"OnboardingTaskStatus"
  END
);

ALTER TABLE "OnboardingTask"
ALTER COLUMN "status" SET DEFAULT 'PENDING'::"OnboardingTaskStatus";

-- Indexes
CREATE INDEX "OnboardingPlan_employeeId_status_idx" ON "OnboardingPlan"("employeeId", "status");
CREATE INDEX "OnboardingPlan_status_startDate_idx" ON "OnboardingPlan"("status", "startDate");
CREATE INDEX "OnboardingTask_planId_status_idx" ON "OnboardingTask"("planId", "status");

-- One active onboarding plan per employee
CREATE UNIQUE INDEX "OnboardingPlan_employeeId_active_key"
ON "OnboardingPlan"("employeeId")
WHERE "status" IN ('NOT_STARTED', 'IN_PROGRESS');

-- Foreign keys
ALTER TABLE "OnboardingPlan"
ADD CONSTRAINT "OnboardingPlan_coordinatorUserId_fkey"
FOREIGN KEY ("coordinatorUserId") REFERENCES "UserAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingTask"
ADD CONSTRAINT "OnboardingTask_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "UserAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingTask"
ADD CONSTRAINT "OnboardingTask_completedByUserId_fkey"
FOREIGN KEY ("completedByUserId") REFERENCES "UserAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
