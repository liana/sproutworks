-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileUrl" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "companyId" TEXT,
    "connectedOn" DATETIME NOT NULL,
    "firstImportId" TEXT NOT NULL,
    "lastImportId" TEXT NOT NULL,
    CONSTRAINT "Person_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Person_firstImportId_fkey" FOREIGN KEY ("firstImportId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Person_lastImportId_fkey" FOREIGN KEY ("lastImportId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConnectionChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "fromCompany" TEXT,
    "toCompany" TEXT,
    "fromTitle" TEXT,
    "toTitle" TEXT,
    "fromImportId" TEXT NOT NULL,
    "toImportId" TEXT NOT NULL,
    "dismissedAt" DATETIME,
    CONSTRAINT "ConnectionChange_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT NOT NULL,
    "connectionCount" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ExportRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "importId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "website" TEXT,
    "positions" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    CONSTRAINT "Profile_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "boardProvider" TEXT,
    "boardCode" TEXT,
    "boardStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "boardLocked" BOOLEAN NOT NULL DEFAULT false,
    "careersUrl" TEXT,
    "excludedAt" DATETIME,
    "watchlistReviewedAt" DATETIME,
    "lastProbedAt" DATETIME,
    "lastFetchedAt" DATETIME,
    "lastJobCount" INTEGER,
    "emptyOrMissingDays" INTEGER NOT NULL DEFAULT 0,
    "staleDismissedAt" DATETIME,
    "etag" TEXT,
    "lastModified" TEXT
);

-- CreateTable
CREATE TABLE "CompanyAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rawName" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "CompanyAlias_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "companyId" TEXT,
    "manualCompanyName" TEXT,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "roleType" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "compensation" TEXT,
    "description" TEXT,
    "foundVia" TEXT,
    "postedAt" DATETIME,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "Posting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postingIds" JSONB NOT NULL,
    CONSTRAINT "Review_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postingId" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL,
    "fit" TEXT NOT NULL,
    "matches" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "aiCallId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitCheck_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FitCheck_aiCallId_fkey" FOREIGN KEY ("aiCallId") REFERENCES "AiCall" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoverLetter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postingId" TEXT NOT NULL,
    "openingType" TEXT NOT NULL,
    "referrerId" TEXT,
    "note" TEXT,
    "body" TEXT NOT NULL,
    "flags" JSONB NOT NULL,
    "regenCount" INTEGER NOT NULL DEFAULT 0,
    "aiCallId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoverLetter_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoverLetter_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoverLetter_aiCallId_fkey" FOREIGN KEY ("aiCallId") REFERENCES "AiCall" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
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
    "lastFetchedAt" DATETIME,
    "etag" TEXT,
    "lastModified" TEXT
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NewsItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PulseEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "newsItemId" TEXT NOT NULL,
    "type" TEXT,
    "companyName" TEXT,
    "companyId" TEXT,
    "amount" TEXT,
    "round" TEXT,
    CONSTRAINT "PulseEvent_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "NewsItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PulseEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Horoscope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "sourceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "Horoscope_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RefreshRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "requestsMade" INTEGER NOT NULL DEFAULT 0,
    "newLeadCount" INTEGER NOT NULL DEFAULT 0,
    "skipped" JSONB NOT NULL DEFAULT [],
    "failures" JSONB NOT NULL DEFAULT []
);

-- CreateTable
CREATE TABLE "AppEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "postingId" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postingId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'APPLIED',
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stageChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reachedInterview" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Application_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "Posting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationStageChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationStageChange_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_profileUrl_key" ON "Person"("profileUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_version_key" ON "Profile"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_importId_key" ON "Profile"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_normalizedName_key" ON "Company"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAlias_rawName_key" ON "CompanyAlias"("rawName");

-- CreateIndex
CREATE UNIQUE INDEX "Posting_source_externalId_key" ON "Posting"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "FitCheck_aiCallId_key" ON "FitCheck"("aiCallId");

-- CreateIndex
CREATE UNIQUE INDEX "FitCheck_postingId_profileVersion_key" ON "FitCheck"("postingId", "profileVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CoverLetter_aiCallId_key" ON "CoverLetter"("aiCallId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_url_key" ON "NewsItem"("url");

-- CreateIndex
CREATE UNIQUE INDEX "PulseEvent_newsItemId_key" ON "PulseEvent"("newsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Horoscope_date_sourceId_key" ON "Horoscope"("date", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_postingId_key" ON "Application"("postingId");
