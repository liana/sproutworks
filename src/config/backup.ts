import os from "node:os";
import path from "node:path";

// Outside the repo, so deleting or re-cloning the code can't take the backups with it.
export const BACKUP = {
  dir: process.env.SPROUT_BACKUP_DIR ?? path.join(os.homedir(), "Sproutworks-backups"),
  keep: 14,
} as const;
