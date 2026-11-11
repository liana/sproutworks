// Company details for the Watchlist: what the company does, and the careers page the user pastes.
import { db } from "@/lib/db";
import { createPoliteFetcher, type Fetcher } from "@/lib/fetch/polite";
import { COMPANY_INFO, CAREERS } from "@/config/fetch";
import { gatherCompanyInfo, type CompanyInfo } from "@/services/companies/info";
import { checkCareersPage, type CareersCheck } from "@/services/careersPages";
import { fixtureFetcher } from "@/services/refresh";

const fixtures = () => process.env.SPROUT_FIXTURE_BOARDS === "1";

// Fixture mode never looks up invented companies on the live web: a real company could share the name.
export async function lookUpCompanyInfo(companyId: string, fetcher?: Fetcher): Promise<CompanyInfo> {
  const c = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const info: CompanyInfo = fixtures()
    ? { website: c.website, blurb: c.blurb, blurbSource: c.blurbSource as CompanyInfo["blurbSource"], industry: c.industry }
    : await gatherCompanyInfo(c.name, c.careersUrl ?? c.website, fetcher ?? createPoliteFetcher({ maxRequestsPerRefresh: COMPANY_INFO.maxRequestsPerCompany }).fetcher);
  await db.company.update({ where: { id: companyId }, data: { ...info, infoFetchedAt: new Date() } });
  return info;
}

// Morning check: fill in a few Watchlist companies each run, on their own request budget.
export async function fillCompanyInfo(): Promise<void> {
  const due = await db.company.findMany({
    where: { boardStatus: "NONE", excludedAt: null, people: { some: {} },
      OR: [{ infoFetchedAt: null }, { infoFetchedAt: { lt: new Date(Date.now() - COMPANY_INFO.refreshDays * 864e5) } }] },
    orderBy: { infoFetchedAt: { sort: "asc", nulls: "first" } },
    take: COMPANY_INFO.perRefresh,
  });
  const { fetcher } = createPoliteFetcher({ maxRequestsPerRefresh: COMPANY_INFO.perRefresh * COMPANY_INFO.maxRequestsPerCompany });
  for (const c of due) {
    try { await lookUpCompanyInfo(c.id, fetcher); } catch { break; } // out of budget: the rest wait for tomorrow
  }
}

// A pasted careers page: saved, approved, and read right away so the user sees what the app can do with it.
export async function saveCareersUrl(companyId: string, url: string): Promise<CareersCheck> {
  const company = await db.company.update({
    where: { id: companyId },
    data: { careersUrl: url, careersSource: "USER", careersReadAs: null, careersCheckedAt: null, boardLocked: true },
  });
  const fetcher = fixtures() ? fixtureFetcher() : createPoliteFetcher({ maxRequestsPerRefresh: 3 + CAREERS.workdayMaxPages }).fetcher;
  const result = await checkCareersPage(company, fetcher);
  // The link may point at the company's own site, a better source for what it does.
  if (!company.infoFetchedAt || !company.blurb) await lookUpCompanyInfo(companyId).catch(() => undefined);
  return result;
}
