-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "list" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "feedUrl" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "logoUrl" TEXT,
    "category" TEXT,
    "robotsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "termsConfirmedAt" DATETIME,
    "removedAt" DATETIME,
    "pathFilter" TEXT,
    "showSummary" BOOLEAN NOT NULL DEFAULT true,
    "staleSince" DATETIME,
    "lastVisitedAt" DATETIME,
    "confirmedAt" DATETIME,
    "lastFetchedAt" DATETIME,
    "etag" TEXT,
    "lastModified" TEXT
);
INSERT INTO "new_Source" ("category", "color", "etag", "feedUrl", "id", "lastFetchedAt", "lastModified", "list", "logoUrl", "name", "removedAt", "robotsAllowed", "termsConfirmedAt", "type", "url") SELECT "category", "color", "etag", "feedUrl", "id", "lastFetchedAt", "lastModified", "list", "logoUrl", "name", "removedAt", "robotsAllowed", "termsConfirmedAt", "type", "url" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
