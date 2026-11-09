// "+ Add a job": a role found elsewhere, entered by hand.
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { normalizeCompanyName } from "@/services/companies/normalize";
import { classifyJob } from "@/services/leads/rules";

export async function addManualPosting(input: { companyName: string; title: string; url?: string; description?: string; foundVia: string }) {
  const normalizedName = normalizeCompanyName(input.companyName) || input.companyName.trim().toLowerCase();
  // Unknown companies get a row (with no board to check) so the job can have a card, a review, and a pipeline entry.
  const company = await db.company.upsert({ where: { normalizedName }, update: {}, create: { name: input.companyName.trim(), normalizedName, boardStatus: "NONE" } });
  const c = classifyJob({ title: input.title, location: null, isRemote: true });
  // Filters warn, they never block: the user chose this job.
  const warnings = c.qualifies ? [] : [{ "not-pm": "Not a product title", "excluded-title": "Title is usually excluded", "not-senior": "Not a senior title", location: "Outside your locations" }[c.reason]];
  const posting = await db.posting.create({
    data: {
      source: "MANUAL", externalId: randomUUID(), companyId: company.id,
      title: input.title.trim(), url: input.url?.trim() || null, description: input.description?.trim() || null,
      roleType: c.qualifies ? c.roleType : /fractional|advisor|interim|contract/i.test(input.title) ? "FRACTIONAL" : "FULL_TIME",
      seniority: c.qualifies ? c.seniority : "unknown", foundVia: input.foundVia,
    },
  });
  return { id: posting.id, warnings };
}

export async function companyNames(): Promise<string[]> {
  return (await db.company.findMany({ where: { people: { some: {} } }, select: { name: true }, orderBy: { name: "asc" } })).map((c) => c.name);
}
