// Dated copies of the database before write-heavy steps. SQLite's VACUUM INTO makes a consistent copy while the app runs.
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { BACKUP } from "@/config/backup";

export async function backup(reason: "refresh" | "import" | "migration"): Promise<string | null> {
  try {
    await mkdir(BACKUP.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(BACKUP.dir, `sproutworks-${stamp}-before-${reason}.db`);
    await db.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const all = (await readdir(BACKUP.dir)).filter((f) => /^sproutworks-.*\.db$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - BACKUP.keep))) await rm(path.join(BACKUP.dir, old));
    return file;
  } catch (e) {
    console.error("Backup failed:", e); // a failed backup never blocks the user's work
    return null;
  }
}

export async function listBackups() {
  try {
    const files = (await readdir(BACKUP.dir)).filter((f) => /^sproutworks-.*\.db$/.test(f)).sort().reverse();
    return Promise.all(files.map(async (f) => {
      const s = await stat(path.join(BACKUP.dir, f));
      return { file: f, sizeMb: Math.round((s.size / 1e6) * 10) / 10, savedAt: s.mtime.toISOString() };
    }));
  } catch { return []; }
}
