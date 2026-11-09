// LinkedIn archive → database, in one transaction. A bad archive changes nothing.
import { db } from "@/lib/db";
import { readArchive } from "@/services/linkedin/parse";
import { normalizeCompanyName } from "@/services/companies/normalize";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

async function companyFor(tx: Tx, raw: string | null): Promise<string | null> {
  if (!raw) return null;
  const alias = await tx.companyAlias.findUnique({ where: { rawName: raw } });
  if (alias) return alias.companyId;
  const normalizedName = normalizeCompanyName(raw);
  if (!normalizedName) return null;
  const company = await tx.company.upsert({ where: { normalizedName }, update: {}, create: { name: raw, normalizedName } });
  await tx.companyAlias.create({ data: { rawName: raw, companyId: company.id } });
  return company.id;
}

export type ImportSummary = { connections: number; companies: number; changes: number; profileVersion: number | null; excludedEmployer: string | null; waitingFor: "connections" | "profile" | null };

export async function importArchive(bytes: ArrayBuffer, fileName: string): Promise<ImportSummary> {
  const { connections, profile } = await readArchive(bytes); // throws ArchiveError before any write

  return db.$transaction(async (tx) => {
    const isFirstImport = (await tx.import.count({ where: { connectionCount: { gt: 0 } } })) === 0;
    const imp = await tx.import.create({ data: { fileName, connectionCount: connections?.length ?? 0 } });
    let changes = 0;
    const companyIds = new Set<string>();

    for (const c of connections ?? []) {
      const companyId = await companyFor(tx, c.company);
      if (companyId) companyIds.add(companyId);
      const existing = await tx.person.findUnique({ where: { profileUrl: c.profileUrl }, include: { company: true } });
      if (existing) {
        const companyChanged = existing.companyId !== companyId;
        const titleChanged = (existing.title ?? null) !== c.title;
        if (companyChanged || titleChanged) {
          changes++;
          await tx.connectionChange.create({
            data: {
              personId: existing.id,
              fromCompany: existing.company?.name ?? null,
              toCompany: c.company,
              fromTitle: existing.title,
              toTitle: c.title,
              fromImportId: existing.lastImportId,
              toImportId: imp.id,
            },
          });
          if (companyChanged && companyId) {
            // A connection's new company goes straight into board resolution.
            await tx.company.updateMany({ where: { id: companyId, boardStatus: "NONE" }, data: { boardStatus: "UNKNOWN", lastProbedAt: null } });
          }
        }
        await tx.person.update({
          where: { id: existing.id },
          data: { firstName: c.firstName, lastName: c.lastName, title: c.title, companyId, connectedOn: c.connectedOn, lastImportId: imp.id },
        });
      } else {
        await tx.person.create({
          data: { profileUrl: c.profileUrl, firstName: c.firstName, lastName: c.lastName, title: c.title, companyId, connectedOn: c.connectedOn, firstImportId: imp.id, lastImportId: imp.id },
        });
      }
    }

    let version: number | null = null;
    if (profile) {
    const last = await tx.profile.findFirst({ orderBy: { version: "desc" } });
    version = (last?.version ?? 0) + 1;
    await tx.profile.create({
      data: {
        version,
        importId: imp.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        headline: profile.headline,
        summary: profile.summary,
        website: profile.website,
        positions: profile.positions,
        skills: profile.skills,
        education: profile.education,
      },
    });
    }

    // First run: the user's current employer is excluded (undo on Admin). Needs both parts, in either order.
    let excludedEmployer: string | null = null;
    const latestProfile = await tx.profile.findFirst({ orderBy: { version: "desc" } });
    const positions = (profile?.positions ?? (latestProfile?.positions as { company: string; finishedOn: string | null }[] | undefined)) ?? [];
    if (connections && isFirstImport || (profile && !(await tx.company.count({ where: { excludedAt: { not: null } } })))) {
      const current = positions.find((p) => !p.finishedOn);
      if (current) {
        const company = await tx.company.findUnique({ where: { normalizedName: normalizeCompanyName(current.company) } });
        if (company) {
          await tx.company.update({ where: { id: company.id }, data: { excludedAt: new Date() } });
          excludedEmployer = company.name;
        }
      }
    }

    const haveConnections = connections !== null || (await tx.person.count()) > 0;
    const haveProfile = version !== null || !!latestProfile;
    return { connections: connections?.length ?? 0, companies: companyIds.size, changes, profileVersion: version, excludedEmployer, waitingFor: !haveConnections ? "connections" : !haveProfile ? "profile" : null };
  }, { timeout: 120_000 });
}
