-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RefreshRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "requestsMade" INTEGER NOT NULL DEFAULT 0,
    "newLeadCount" INTEGER NOT NULL DEFAULT 0,
    "falseResurfaces" INTEGER NOT NULL DEFAULT 0,
    "skipped" JSONB NOT NULL DEFAULT [],
    "failures" JSONB NOT NULL DEFAULT []
);
INSERT INTO "new_RefreshRun" ("failures", "finishedAt", "id", "newLeadCount", "requestsMade", "skipped", "startedAt", "status") SELECT "failures", "finishedAt", "id", "newLeadCount", "requestsMade", "skipped", "startedAt", "status" FROM "RefreshRun";
DROP TABLE "RefreshRun";
ALTER TABLE "new_RefreshRun" RENAME TO "RefreshRun";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
