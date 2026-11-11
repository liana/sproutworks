// Companies' own careers pages, checked every morning alongside the job boards, and found from homepages.
import { db } from "@/lib/db";
import { createPoliteFetcher, RequestCapReached, BLOCKED_STATUS, type Fetcher } from "@/lib/fetch/polite";
import { CAREERS, FETCH, isNeverFetch } from "@/config/fetch";
import { fetchBoard, type BoardPosting } from "@/services/boards/adapters";
import { boardInText } from "@/services/boards/probe";
import { parseWorkdayUrl, fetchWorkday } from "@/services/boards/workday";
import { readCareersPage, qualifyingFromPage } from "@/services/boards/careersPage";
import { discoverCareersPage } from "@/services/companies/discover";
import { robotsAllows } from "@/services/feeds/robots";
import { closuresAllowed } from "@/services/leads/rules";
import { setBoard, rejectBoard } from "@/services/actions";

export type ReadAs = "BOARD" | "WORKDAY" | "LISTINGS" | "TEXT" | "UNREADABLE" | "LINKEDIN" | "FAILED";
export type CareersCheck = { readAs: ReadAs; jobCount: number; provider?: string };
type Company = { id: string; name: string; careersUrl: string | null; lastJobCount: number | null };
type Failures = { company: string; status: number }[];

const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5);

// Record what a careers page lists today. IDs are per company: two pages can both list "Head of Product".
async function recordPostings(company: Company, source: "WORKDAY" | "CAREERS_PAGE", all: BoardPosting[], complete: boolean): Promise<number> {
  const now = new Date();
  const qualifying = qualifyingFromPage(all);
  const ids = qualifying.map((p) => `${company.id}:${p.externalId}`);
  for (const [i, p] of qualifying.entries()) {
    await db.posting.upsert({
      where: { source_externalId: { source, externalId: ids[i] } },
      update: { title: p.title, location: p.location, isRemote: p.isRemote, url: p.url, lastSeenAt: now, closedAt: null, postedAt: p.postedAt ?? undefined },
      create: { source, externalId: ids[i], companyId: company.id, title: p.title, location: p.location, isRemote: p.isRemote, url: p.url, roleType: p.roleType, seniority: p.seniority, postedAt: p.postedAt },
    });
  }
  if (closuresAllowed(complete, all.length, company.lastJobCount, FETCH.closureMinFraction)) {
    await db.posting.updateMany({ where: { companyId: company.id, source, closedAt: null, externalId: { notIn: ids } }, data: { closedAt: now } });
  }
  await db.company.update({ where: { id: company.id }, data: { lastJobCount: all.length } });
  return qualifying.length;
}

export async function checkCareersPage(company: Company, fetcher: Fetcher, failures: Failures = []): Promise<CareersCheck> {
  const url = company.careersUrl;
  if (!url) return { readAs: "UNREADABLE", jobCount: 0 };
  const done = async (r: CareersCheck) => {
    if (r.readAs !== "FAILED") await db.company.update({ where: { id: company.id }, data: { careersReadAs: r.readAs === "BOARD" ? null : r.readAs, careersCheckedAt: new Date() } });
    return r;
  };

  const board = async (provider: "GREENHOUSE" | "LEVER" | "ASHBY", code: string): Promise<CareersCheck | null> => {
    const r = await fetchBoard(provider, code, fetcher);
    if (r.kind !== "ok") return null;
    await setBoard(company.id, provider, code); // confirmed: from now on it's read like any board
    return { readAs: "BOARD", jobCount: r.postings.length, provider };
  };
  const workday = async (wdUrl: string): Promise<CareersCheck> => {
    const site = parseWorkdayUrl(wdUrl);
    if (!site) return { readAs: "UNREADABLE", jobCount: 0 };
    if (wdUrl !== url) await db.company.update({ where: { id: company.id }, data: { careersUrl: wdUrl } }); // the page sends people to Workday: watch that
    const r = await fetchWorkday(site, fetcher, CAREERS.workdayMaxPages);
    if (r.kind === "failed") { failures.push({ company: `${company.name} (Workday)`, status: r.status }); return { readAs: "UNREADABLE", jobCount: 0 }; }
    return { readAs: "WORKDAY", jobCount: await recordPostings(company, "WORKDAY", r.postings, r.complete) };
  };

  // Jobs listed on LinkedIn: kept as a link for the user, never requested (NEVER_FETCH_HOSTS).
  if (isNeverFetch(url)) return done({ readAs: "LINKEDIN", jobCount: 0 });
  const inUrl = boardInText(url);
  if (inUrl) return done((await board(inUrl.provider, inUrl.code)) ?? { readAs: "UNREADABLE", jobCount: 0 });
  if (parseWorkdayUrl(url)) return done(await workday(url));

  const u = new URL(url);
  const robots = await fetcher(`${u.origin}/robots.txt`);
  if (robots.status === 200 && typeof robots.body === "string" && !robotsAllows(robots.body, u.pathname)) return done({ readAs: "UNREADABLE", jobCount: 0 });
  const page = await fetcher(url);
  if (page.status === BLOCKED_STATUS) return done({ readAs: "LINKEDIN", jobCount: 0 }); // the page redirects to LinkedIn
  if (page.status !== 200 || typeof page.body !== "string") { failures.push({ company: `${company.name} (careers page)`, status: page.status }); return { readAs: "FAILED", jobCount: 0 }; }

  const read = readCareersPage(page.body, page.finalUrl ?? url);
  if (read.kind === "BOARD") return done((await board(read.provider, read.code)) ?? { readAs: "UNREADABLE", jobCount: 0 });
  if (read.kind === "WORKDAY") return done(await workday(read.url));
  if (read.kind === "UNREADABLE") return done({ readAs: "UNREADABLE", jobCount: 0 });
  return done({ readAs: read.kind, jobCount: await recordPostings(company, "CAREERS_PAGE", read.postings, true) });
}

// Morning check, part 1: every saved careers page, at most once a day.
export async function checkCareersPages(fetcher: Fetcher, failures: Failures): Promise<void> {
  const due = await db.company.findMany({
    where: { careersUrl: { not: null }, boardStatus: "NONE", excludedAt: null, people: { some: {} },
      OR: [{ careersCheckedAt: null }, { careersCheckedAt: { lt: hoursAgo(FETCH.minHoursBetweenFetches) } }] },
    orderBy: { careersCheckedAt: { sort: "asc", nulls: "first" } },
  });
  for (const c of due) {
    try { await checkCareersPage(c, fetcher, failures); }
    catch (e) { if (e instanceof RequestCapReached) break; failures.push({ company: `${c.name} (careers page)`, status: -1 }); }
  }
}

// Morning check, part 2: follow a few homepages' Careers links. A find is used right away and read in the
// same check; the user can mark it "Wrong company" from Today.
export async function discoverCareersPages(fetcher: Fetcher, failures: Failures): Promise<void> {
  const due = await db.company.findMany({
    where: { boardStatus: "NONE", careersUrl: null, careersLookedAt: null, website: { not: null }, excludedAt: null, people: { some: {} } },
    take: CAREERS.discoverPerRefresh,
  });
  for (const c of due) {
    try {
      const found = await discoverCareersPage(c.website!, fetcher);
      const updated = await db.company.update({ where: { id: c.id }, data: found
        ? { careersLookedAt: new Date(), careersUrl: found.url, careersSource: "FOUND" }
        : { careersLookedAt: new Date() } });
      if (found) await checkCareersPage(updated, fetcher, failures);
    } catch (e) { if (e instanceof RequestCapReached) break; }
  }
}

export async function refreshCareers(failures: Failures, fetcher?: Fetcher): Promise<void> {
  const f = fetcher ?? createPoliteFetcher({ maxRequestsPerRefresh: CAREERS.maxRequestsPerRefresh }).fetcher;
  await checkCareersPages(f, failures);
  await discoverCareersPages(f, failures);
}

// "Wrong company" on a match the app made by itself: drop it, close its jobs, and never try it again.
export async function markWrongMatch(id: string): Promise<void> {
  const c = await db.company.findUniqueOrThrow({ where: { id } });
  const now = new Date();
  if (c.boardStatus === "CONFIRMED" && !c.boardLocked && c.boardProvider) {
    await db.posting.updateMany({ where: { companyId: id, source: c.boardProvider, closedAt: null }, data: { closedAt: now } });
    await rejectBoard(id); // locks "no board", so the guess isn't retried
  }
  if (c.careersSource === "FOUND") {
    await db.posting.updateMany({ where: { companyId: id, source: { in: ["WORKDAY", "CAREERS_PAGE"] }, closedAt: null }, data: { closedAt: now } });
    await db.company.update({ where: { id }, data: { careersUrl: null, careersSource: null, careersReadAs: null } }); // careersLookedAt stays set: not looked for again
  }
}
