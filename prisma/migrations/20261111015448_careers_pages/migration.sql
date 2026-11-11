-- AlterTable
ALTER TABLE "Company" ADD COLUMN "careersCheckedAt" DATETIME;
ALTER TABLE "Company" ADD COLUMN "careersLookedAt" DATETIME;
ALTER TABLE "Company" ADD COLUMN "careersReadAs" TEXT;
ALTER TABLE "Company" ADD COLUMN "careersSource" TEXT;

-- Links saved before this change were pasted by the user.
UPDATE "Company" SET "careersSource" = 'USER' WHERE "careersUrl" IS NOT NULL;
-- Boards no longer wait for confirmation: matches still waiting are used from the next morning check,
-- unlocked so "Wrong company?" can remove them.
UPDATE "Company" SET "boardStatus" = 'CONFIRMED', "boardLocked" = 0, "lastFetchedAt" = NULL WHERE "boardStatus" = 'PENDING';
