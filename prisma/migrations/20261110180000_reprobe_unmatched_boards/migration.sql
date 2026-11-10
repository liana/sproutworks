-- Data only. Earlier probes marked a company "no board" when its board existed but had no open jobs.
-- Send every automatic "no board" back to the resolver; decisions the user locked stay put.
UPDATE "Company" SET "boardStatus" = 'UNKNOWN', "lastProbedAt" = NULL WHERE "boardStatus" = 'NONE' AND "boardLocked" = 0;
