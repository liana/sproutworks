// Restore a backup: stop the app first, then `npm run restore -- <file>`. The current database is kept as a copy.
import { copyFile, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const arg = process.argv[2];
if (!arg) { console.error("Usage: npm run restore -- <backup file name or path>"); process.exit(1); }
const dir = process.env.SPROUT_BACKUP_DIR ?? path.join(os.homedir(), "Sproutworks-backups");
const src = arg.includes("/") ? arg : path.join(dir, arg);
const live = path.join(process.cwd(), "prisma", "sproutworks.db");
await access(src);
const keep = `${live}.before-restore-${Date.now()}`;
await copyFile(live, keep).catch(() => {});
await copyFile(src, live);
console.log(`Restored ${path.basename(src)}. Your previous data is at ${keep}. Start the app with npm run dev.`);
