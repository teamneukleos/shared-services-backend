-- CreateEnum
CREATE TYPE "LeaveTransactionType" AS ENUM ('RESERVE', 'RELEASE', 'CONSUME');

-- AlterTable LeaveType
ALTER TABLE "LeaveType"
ADD COLUMN "organisationId" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "status" "RecordStatus",
ADD COLUMN "createdAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill organisation from the single org if present, else fail-safe delete orphans
UPDATE "LeaveType" AS lt
SET "organisationId" = o."id"
FROM (
  SELECT "id" FROM "Organisation" ORDER BY "createdAt" ASC LIMIT 1
) AS o
WHERE lt."organisationId" IS NULL;

DELETE FROM "LeaveType" WHERE "organisationId" IS NULL;

UPDATE "LeaveType"
SET "status" = 'ACTIVE'
WHERE "status" IS NULL;

UPDATE "LeaveType"
SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "LeaveType"
ALTER COLUMN "organisationId" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "unit" SET DEFAULT 'DAYS',
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" SET NOT NULL;

DROP INDEX IF EXISTS "LeaveType_code_key";
CREATE UNIQUE INDEX "LeaveType_organisationId_code_key" ON "LeaveType"("organisationId", "code");
CREATE INDEX "LeaveType_organisationId_status_idx" ON "LeaveType"("organisationId", "status");

ALTER TABLE "LeaveType"
ADD CONSTRAINT "LeaveType_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable LeaveBalance
ALTER TABLE "LeaveBalance"
ADD COLUMN "entitled" DECIMAL(10,2),
ADD COLUMN "createdAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "LeaveBalance"
SET "entitled" = ("available" + "reserved" + "used")
WHERE "entitled" IS NULL;

UPDATE "LeaveBalance"
SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
    "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP);

ALTER TABLE "LeaveBalance"
ALTER COLUMN "entitled" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE INDEX "LeaveBalance_leaveTypeId_idx" ON "LeaveBalance"("leaveTypeId");

-- AlterTable LeaveRequest
ALTER TABLE "LeaveRequest"
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "reviewComment" TEXT;

UPDATE "LeaveRequest"
SET "submittedAt" = COALESCE("submittedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "submittedAt" IS NULL;

ALTER TABLE "LeaveRequest"
ALTER COLUMN "submittedAt" SET NOT NULL,
ALTER COLUMN "submittedAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE INDEX "LeaveRequest_employeeId_status_startDate_endDate_idx"
ON "LeaveRequest"("employeeId", "status", "startDate", "endDate");
CREATE INDEX "LeaveRequest_leaveTypeId_status_idx" ON "LeaveRequest"("leaveTypeId", "status");
CREATE INDEX "LeaveRequest_status_submittedAt_idx" ON "LeaveRequest"("status", "submittedAt");

ALTER TABLE "LeaveRequest"
ADD CONSTRAINT "LeaveRequest_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "UserAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable LeaveTransaction: convert type to enum
ALTER TABLE "LeaveTransaction"
ALTER COLUMN "type" TYPE "LeaveTransactionType"
USING (
  CASE upper(trim("type"))
    WHEN 'RESERVE' THEN 'RESERVE'::"LeaveTransactionType"
    WHEN 'RELEASE' THEN 'RELEASE'::"LeaveTransactionType"
    WHEN 'CONSUME' THEN 'CONSUME'::"LeaveTransactionType"
    WHEN 'DEDUCT' THEN 'CONSUME'::"LeaveTransactionType"
    WHEN 'RESTORE' THEN 'RELEASE'::"LeaveTransactionType"
    ELSE 'RESERVE'::"LeaveTransactionType"
  END
);

CREATE UNIQUE INDEX "LeaveTransaction_leaveRequestId_type_key"
ON "LeaveTransaction"("leaveRequestId", "type");
CREATE INDEX "LeaveTransaction_employeeId_occurredAt_idx"
ON "LeaveTransaction"("employeeId", "occurredAt");
