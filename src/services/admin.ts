import { db } from "@/lib/db";
import { listSources } from "@/services/sources";
import { ensureSeedSources } from "@/services/news";
import { listBackups } from "@/services/backup";
import { BACKUP } from "@/config/backup";
import { FETCH } from "@/config/fetch";

export async function buildAdmin() {
  await ensureSeedSources();
  const sources = await listSources();
  const [stale, backups] = await Promise.all([
    db.company.findMany({ where: { boardStatus: "CONFIRMED", excludedAt: null, emptyOrMissingDays: { gte: FETCH.staleBoardDays } }, orderBy: { name: "asc" } }),
    listBackups(),
  ]);
  const [lastImport, people, exportRequest, pending, excluded, runs, unreadable] = await Promise.all([
    db.import.findFirst({ orderBy: { importedAt: "desc" } }),
    db.person.count(),
    db.exportRequest.findFirst({ orderBy: { requestedAt: "desc" } }),
    db.company.findMany({ where: { boardStatus: "PENDING", excludedAt: null }, orderBy: { name: "asc" } }),
    db.company.findMany({ where: { excludedAt: { not: null } }, orderBy: { excludedAt: "desc" } }),
    db.refreshRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
    db.company.count({ where: { boardStatus: "NONE", excludedAt: null, people: { some: {} } } }),
  ]);
  return {
    linkedin: {
      lastImportedAt: lastImport?.importedAt.toISOString() ?? null,
      connections: people,
      exportRequestedAt: exportRequest && (!lastImport || exportRequest.requestedAt > lastImport.importedAt) ? exportRequest.requestedAt.toISOString() : null,
    },
    pending: pending.map((c) => ({ id: c.id, name: c.name, provider: c.boardProvider, code: c.boardCode, jobCount: c.probeJobCount, sample: c.probeSampleTitle })),
    excluded: excluded.map((c) => ({ id: c.id, name: c.name, excludedAt: c.excludedAt!.toISOString() })),
    runs: runs.map((r) => ({
      id: r.id,
      startedAt: r.startedAt.toISOString(),
      minutes: r.finishedAt ? Math.round(((r.finishedAt.getTime() - r.startedAt.getTime()) / 6e4) * 10) / 10 : null,
      status: r.status,
      requests: r.requestsMade,
      failures: (r.failures as { company: string; status: number }[]) ?? [],
      skipped: ((r.skipped as string[]) ?? []).length,
    })),
    unreadableCount: unreadable,
    sources,
    stale: stale.map((c) => ({ id: c.id, name: c.name, provider: c.boardProvider, code: c.boardCode, days: c.emptyOrMissingDays })),
    backups: { dir: BACKUP.dir, keep: BACKUP.keep, files: backups },
  };
}
