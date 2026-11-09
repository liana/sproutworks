import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "sproutworks.db")}`;

// One client per process. In `next dev`, hot reload re-evaluates modules,
// so the client is cached on globalThis to avoid opening a new pool per edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaLibSql({ url }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
