// `npm run db:migrate`: copy the database, then apply schema changes.
import { copyFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const dir = process.env.SPROUT_BACKUP_DIR ?? path.join(os.homedir(), "Sproutworks-backups");
const live = path.join(process.cwd(), "prisma", "sproutworks.db");
await mkdir(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
await copyFile(live, path.join(dir, `sproutworks-${stamp}-before-migration.db`)).catch(() => console.log("No database yet; nothing to back up."));
execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
execFileSync("npx", ["prisma", "generate"], { stdio: "inherit" });
