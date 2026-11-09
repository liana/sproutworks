import path from "node:path";
import { defineConfig } from "prisma/config";

// The database lives next to the schema and is gitignored (*.db).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"] ?? `file:${path.join(process.cwd(), "prisma", "sproutworks.db")}`,
  },
});
