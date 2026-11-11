import { db } from "@/lib/db";
import { listSources } from "@/services/sources";
import { ensureSeedSources } from "@/services/news";
import { listBackups } from "@/services/backup";
import { BACKUP } from "@/config/backup";
import { FETCH } from "@/config/fetch";
import { publicBoardUrl } from "@/services/boards/probe";

export async function buildAdmin() {
  await ensureSeedSources();
  const sources = await listSources();
  const live = { excludedAt: null, people: { some: {} } };
  const since = new Date(Date.now() - 14 * 864e5);
  const [boardsDaily, careersDaily, careersUnreadable, autoMatched] = await Promise.all([
    db.company.count({ where: { ...live, boardStatus: "CONFIRMED" } }),
    db.company.count({ where: { ...live, boardStatus: "NONE", careersReadAs: { in: ["WORKDAY", "LISTINGS", "TEXT"] } } }),
    db.company.count({ where: { ...live, boardStatus: "NONE", careersReadAs: "UNREADABLE" } }),
    // Matches the app made by itself in the last two weeks, for an optional look.
    db.company.findMany({ where: { ...live, OR: [
      { boardStatus: "CONFIRMED", boardLocked: false, lastProbedAt: { gte: since } },
      { careersSource: "FOUND", careersUrl: { not: null }, careersLookedAt: { gte: since } },
    ] }, orderBy: { name: "asc" } }),
  ]);
  const [stale, backups] = await Promise.all([
    db.company.findMany({ where: { boardStatus: "CONFIRMED", excludedAt: null, emptyOrMissingDays: { gte: FETCH.staleBoardDays } }, orderBy: { name: "asc" } }),
    listBackups(),
  ]);
  const [lastImport, people, exportRequest, excluded, runs, unreadable] = await Promise.all([
    db.import.findFirst({ orderBy: { importedAt: "desc" } }),
    db.person.count(),
    db.exportRequest.findFirst({ orderBy: { requestedAt: "desc" } }),
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
    autoMatched: autoMatched.map((c) => {
      const board = c.boardStatus === "CONFIRMED" && c.boardProvider && c.boardCode;
      const url = board ? publicBoardUrl(c.boardProvider!, c.boardCode!) : c.careersUrl!;
      return { id: c.id, name: c.name, url, what: board ? `${c.boardProvider!.toLowerCase()} board` : new URL(url).hostname.replace(/^www\./, "") };
    }),
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
    coverage: { boards: boardsDaily, careersPages: careersDaily, unreadable: careersUnreadable },
    sources,
    stale: stale.map((c) => ({ id: c.id, name: c.name, provider: c.boardProvider, code: c.boardCode, days: c.emptyOrMissingDays })),
    backups: { dir: BACKUP.dir, keep: BACKUP.keep, files: backups },
  };
}
