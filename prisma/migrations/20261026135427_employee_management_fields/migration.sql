-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY', 'OTHER');

-- AlterTable Person
ALTER TABLE "Person" ADD COLUMN "preferredName" TEXT;

-- AlterTable Employee: add columns as nullable for safe backfill
ALTER TABLE "Employee"
ADD COLUMN "organisationId" TEXT,
ADD COLUMN "workEmail" TEXT,
ADD COLUMN "jobTitle" TEXT,
ADD COLUMN "employmentType" "EmploymentType";

-- Backfill organisationId from department → business unit
UPDATE "Employee" AS e
SET "organisationId" = bu."organisationId"
FROM "Department" AS d
INNER JOIN "BusinessUnit" AS bu ON bu."id" = d."businessUnitId"
WHERE e."departmentId" = d."id"
  AND e."organisationId" IS NULL;

-- Backfill job title from position title when available
UPDATE "Employee" AS e
SET "jobTitle" = p."title"
FROM "Position" AS p
WHERE e."positionId" = p."id"
  AND e."jobTitle" IS NULL;

UPDATE "Employee"
SET "jobTitle" = 'Unspecified'
WHERE "jobTitle" IS NULL;

-- Backfill work email placeholders for any legacy rows (unique per organisation)
UPDATE "Employee"
SET "workEmail" = lower("employeeNumber") || '@legacy.invalid'
WHERE "workEmail" IS NULL;

UPDATE "Employee"
SET "employmentType" = 'FULL_TIME'
WHERE "employmentType" IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE "Employee"
ALTER COLUMN "organisationId" SET NOT NULL,
ALTER COLUMN "workEmail" SET NOT NULL,
ALTER COLUMN "jobTitle" SET NOT NULL,
ALTER COLUMN "employmentType" SET NOT NULL,
ALTER COLUMN "employmentType" SET DEFAULT 'FULL_TIME';

-- Drop global employee number uniqueness
DROP INDEX IF EXISTS "Employee_employeeNumber_key";

-- Organisation-scoped uniqueness and indexes
CREATE UNIQUE INDEX "Employee_organisationId_employeeNumber_key" ON "Employee"("organisationId", "employeeNumber");
CREATE UNIQUE INDEX "Employee_organisationId_workEmail_key" ON "Employee"("organisationId", "workEmail");
CREATE INDEX "Employee_organisationId_status_idx" ON "Employee"("organisationId", "status");
CREATE INDEX "Employee_organisationId_departmentId_idx" ON "Employee"("organisationId", "departmentId");
CREATE INDEX "Employee_organisationId_managerId_idx" ON "Employee"("organisationId", "managerId");

-- AddForeignKey
ALTER TABLE "Employee"
ADD CONSTRAINT "Employee_organisationId_fkey"
FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Convert Employment.type from free text to EmploymentType
ALTER TABLE "Employment"
ALTER COLUMN "type" TYPE "EmploymentType"
USING (
  CASE upper(trim("type"))
    WHEN 'FULL_TIME' THEN 'FULL_TIME'::"EmploymentType"
    WHEN 'PART_TIME' THEN 'PART_TIME'::"EmploymentType"
    WHEN 'CONTRACT' THEN 'CONTRACT'::"EmploymentType"
    WHEN 'INTERN' THEN 'INTERN'::"EmploymentType"
    WHEN 'TEMPORARY' THEN 'TEMPORARY'::"EmploymentType"
    ELSE 'OTHER'::"EmploymentType"
  END
);
