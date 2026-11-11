// The once-a-day morning check: resolve job boards, fetch confirmed ones, record postings.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { FETCH } from "@/config/fetch";
import { createPoliteFetcher, RequestCapReached, type Fetcher } from "@/lib/fetch/polite";
import { fetchBoard, type Provider, type BoardPosting } from "@/services/boards/adapters";
import { boardCodeCandidates } from "@/services/companies/normalize";
import { classifyJob, closuresAllowed, countsTowardStale } from "@/services/leads/rules";
import { probeBoards } from "@/services/boards/probe";
import { refreshFeeds } from "@/services/news";
import { backup } from "@/services/backup";
import { parseFeed } from "@/services/feeds/parse";
import { ventureFizzPostings } from "@/services/boards/venturefizz";

const PROVIDERS: Provider[] = ["GREENHOUSE", "LEVER", "ASHBY"];

type Progress = { runId: string; checked: number; total: number; state: "RUNNING" | "DONE" | "STOPPED_AT_CAP" };
const g = globalThis as unknown as { sproutRefresh?: Progress };
export const currentProgress = (): Progress | null => g.sproutRefresh ?? null;

// Development without real data: SPROUT_FIXTURE_BOARDS=1 serves recorded responses from test/fixtures/boards.
export function fixtureFetcher(): Fetcher {
  return async (url, opts) => {
    const host = new URL(url).host;
    const pages = path.join(process.cwd(), "test/fixtures/pages");
    if (host.endsWith(".myworkdayjobs.com")) {
      const tenant = host.split(".")[0];
      const offset = (opts?.json as { offset?: number } | undefined)?.offset ?? 0;
      try { return { status: 200, body: offset ? { total: 0, jobPostings: [] } : JSON.parse(await readFile(path.join(pages, `workday-${tenant}.json`), "utf8")), etag: null, host }; }
      catch { return { status: 404, body: null, etag: null, host }; }
    }
    // A provider's public board page (its title shows the company's name), e.g. boards.greenhouse.io/northfield
    if (/^(boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com)$/.test(host)) {
      const code = new URL(url).pathname.split("/")[1] ?? "";
      try { return { status: 200, body: await readFile(path.join(pages, `board-${code}.html`), "utf8"), etag: null, host }; }
      catch { return { status: 404, body: null, etag: null, host }; }
    }
    if (!/greenhouse|lever|ashby/.test(host)) {
      if (url.endsWith("/robots.txt")) return { status: 404, body: null, etag: null, host };
      try { return { status: 200, body: await readFile(path.join(pages, `${host}.html`), "utf8"), etag: null, host, finalUrl: url }; }
      catch { return { status: 404, body: null, etag: null, host }; }
    }
    const provider = host.includes("greenhouse") ? "greenhouse" : host.includes("lever") ? "lever" : "ashby";
    const code = decodeURIComponent(url.match(/(?:boards|postings|job-board)\/([^/?]+)/)?.[1] ?? "");
    if (provider !== "ashby" && /\/(jobs|postings\/[^/?]+)\/[^/?]+(\?|$)/.test(new URL(url).pathname + "?")) return { status: 404, body: null, etag: null, host }; // single-job lookups aren't recorded
    if (provider === "lever" && !url.includes("skip=0")) return { status: 200, body: [], etag: null, host };
    try {
      const body = JSON.parse(await readFile(path.join(process.cwd(), "test/fixtures/boards", `${provider}-${code}.json`), "utf8"));
      return { status: 200, body, etag: null, host };
    } catch {
      return { status: 404, body: null, etag: null, host };
    }
  };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5);

export async function startRefreshIfDue(): Promise<void> {
  if (g.sproutRefresh?.state === "RUNNING") return;
  if ((await db.import.count()) === 0) return; // nothing to check before the first import
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const ranToday = await db.refreshRun.findFirst({ where: { startedAt: { gte: startOfDay } } });
  if (ranToday) return;
  void runRefresh();
}

export async function runRefresh(): Promise<void> {
  if (g.sproutRefresh?.state === "RUNNING") return; // a second click is ignored
  const run = await db.refreshRun.create({ data: { status: "running" } });
  const progress: Progress = { runId: run.id, checked: 0, total: 0, state: "RUNNING" };
  g.sproutRefresh = progress;
  const polite = createPoliteFetcher();
  const fetcher = process.env.SPROUT_FIXTURE_BOARDS === "1" ? fixtureFetcher() : polite.fetcher;
  const failures: { company: string; status: number }[] = [];
  const skipped: string[] = [];
  let stoppedAtCap = false;

  await backup("refresh");
  // Feeds are real even in fixture mode: they need no personal data.
  try { await refreshFeeds(polite.fetcher, failures); } catch (e) { if (e instanceof RequestCapReached) stoppedAtCap = true; else failures.push({ company: "News feeds", status: -1 }); }

  try { await refreshAggregators(polite.fetcher, failures); } catch (e) { if (e instanceof RequestCapReached) stoppedAtCap = true; else failures.push({ company: "VentureFizz", status: -1 }); }

  const companies = await db.company.findMany({
    where: {
      excludedAt: null,
      people: { some: {} },
      OR: [
        { boardStatus: "UNKNOWN", OR: [{ lastProbedAt: null }, { lastProbedAt: { lt: hoursAgo(24 * FETCH.resolverRetryDays) } }] },
        { boardStatus: "CONFIRMED", OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: hoursAgo(FETCH.minHoursBetweenFetches) } }] },
      ],
    },
    orderBy: [{ boardStatus: "asc" }, { name: "asc" }],
  });
  progress.total = companies.length;

  for (const company of companies) {
    try {
      if (company.boardStatus === "UNKNOWN") await probe(company, fetcher, failures);
      else await fetchConfirmed(company.id, company.name, company.boardProvider as Provider, company.boardCode!, company.etag, company.lastJobCount, fetcher, failures);
    } catch (e) {
      if (e instanceof RequestCapReached) { stoppedAtCap = true; skipped.push(...companies.slice(progress.checked).map((c) => c.name)); break; }
      failures.push({ company: company.name, status: -1 });
    }
    progress.checked++;
  }

  // Company descriptions run on their own small budget, so they never cost a board check.
  try { const { fillCompanyInfo } = await import("@/services/companyInfo"); await fillCompanyInfo(); } catch { failures.push({ company: "Company info", status: -1 }); }
  // Saved careers pages and Workday sites, then a few homepages' Careers links: also on their own budget.
  try {
    const { refreshCareers } = await import("@/services/careersPages");
    await refreshCareers(failures, process.env.SPROUT_FIXTURE_BOARDS === "1" ? fixtureFetcher() : undefined);
  } catch { failures.push({ company: "Careers pages", status: -1 }); }

  progress.state = stoppedAtCap ? "STOPPED_AT_CAP" : "DONE";
  const { countNewLeads, countFalseResurfaces } = await import("@/services/today");
  await db.refreshRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), status: stoppedAtCap ? "stopped-at-cap" : "done", requestsMade: polite.requestsMade(), newLeadCount: await countNewLeads(), falseResurfaces: await countFalseResurfaces(), skipped, failures },
  });
}

// A found board is used right away (no confirmation) and read in the same morning check.
// Unlocked, so the user can still mark it "Wrong company" from Today.
async function probe(company: { id: string; name: string; lastJobCount: number | null }, fetcher: Fetcher, failures: { company: string; status: number }[]) {
  const match = await probeBoards(boardCodeCandidates(company.name), PROVIDERS, fetcher, company.name);
  if (!match) {
    await db.company.update({ where: { id: company.id }, data: { boardStatus: "NONE", lastProbedAt: new Date() } });
    return;
  }
  const sample = match.postings.find((p) => classifyJob(p).qualifies) ?? match.postings[0];
  await db.company.update({
    where: { id: company.id },
    data: { boardStatus: "CONFIRMED", boardLocked: false, boardProvider: match.provider, boardCode: match.code, lastProbedAt: new Date(), probeJobCount: match.postings.length, probeSampleTitle: sample?.title ?? null, emptyOrMissingDays: 0 },
  });
  await fetchConfirmed(company.id, company.name, match.provider, match.code, null, company.lastJobCount, fetcher, failures);
}

async function fetchConfirmed(
  companyId: string, name: string, provider: Provider, code: string, etag: string | null, lastJobCount: number | null,
  fetcher: Fetcher, failures: { company: string; status: number }[],
) {
  const r = await fetchBoard(provider, code, fetcher, etag);
  const now = new Date();
  if (r.kind === "not-modified") { await db.company.update({ where: { id: companyId }, data: { lastFetchedAt: now } }); return; }
  if (r.kind === "failed") { failures.push({ company: name, status: r.status }); return; }
  if (r.kind === "missing" || r.postings.length === 0) {
    const stale = countsTowardStale(r.kind === "missing", lastJobCount);
    await db.company.update({ where: { id: companyId }, data: { lastFetchedAt: now, emptyOrMissingDays: stale ? { increment: 1 } : 0 } });
    return;
  }
  const qualifying: (BoardPosting & { roleType: "FULL_TIME" | "FRACTIONAL"; seniority: string })[] = [];
  for (const p of r.postings) {
    const c = classifyJob(p);
    if (c.qualifies) qualifying.push({ ...p, roleType: c.roleType, seniority: c.seniority });
  }
  for (const p of qualifying) {
    await db.posting.upsert({
      where: { source_externalId: { source: provider, externalId: p.externalId } },
      update: { title: p.title, location: p.location, isRemote: p.isRemote, url: p.url, compensation: p.compensation, lastSeenAt: now, closedAt: null, postedAt: p.postedAt ?? undefined },
      create: { source: provider, externalId: p.externalId, companyId, title: p.title, location: p.location, isRemote: p.isRemote, url: p.url, roleType: p.roleType, seniority: p.seniority, compensation: p.compensation, postedAt: p.postedAt },
    });
  }
  if (closuresAllowed(r.complete, r.postings.length, lastJobCount, FETCH.closureMinFraction)) {
    await db.posting.updateMany({
      where: { companyId, source: provider, closedAt: null, externalId: { notIn: qualifying.map((p) => p.externalId) } },
      data: { closedAt: now },
    });
  } else {
    failures.push({ company: `${name} (partial fetch, nothing closed)`, status: 206 });
  }
  await db.company.update({ where: { id: companyId }, data: { lastFetchedAt: now, lastJobCount: r.postings.length, emptyOrMissingDays: 0, etag: r.etag } });
}

// VentureFizz and other job aggregators: one feed request a day, matched to companies the user knows people at.
async function refreshAggregators(fetcher: Fetcher, failures: { company: string; status: number }[]) {
  const sources = await db.source.findMany({
    where: { type: "JOB_AGGREGATOR_RSS", removedAt: null, termsConfirmedAt: { not: null }, feedUrl: { not: null },
      OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: hoursAgo(FETCH.minHoursBetweenFetches) } }] },
  });
  if (!sources.length) return;
  const companies = await db.company.findMany({ where: { excludedAt: null, people: { some: {} } }, select: { id: true, name: true } });
  const now = new Date();
  for (const src of sources) {
    const res = await fetcher(src.feedUrl!);
    if (res.status !== 200 || typeof res.body !== "string") { failures.push({ company: `${src.name} feed`, status: res.status }); continue; }
    await db.source.update({ where: { id: src.id }, data: { lastFetchedAt: now } });
    for (const p of ventureFizzPostings(parseFeed(res.body), companies)) {
      const c = classifyJob({ title: p.title, location: "Boston, MA" }); // a Boston board; postings carry no location
      if (!c.qualifies) continue;
      await db.posting.upsert({
        where: { source_externalId: { source: "VENTUREFIZZ", externalId: p.externalId } },
        update: { lastSeenAt: now, closedAt: null },
        create: { source: "VENTUREFIZZ", externalId: p.externalId, companyId: p.companyId, title: p.title, location: "Boston area", url: p.url, roleType: c.roleType, seniority: c.seniority, postedAt: p.postedAt },
      });
    }
  }
  // The feed holds only the newest 50 postings, so absence means nothing. Close what hasn't been seen in 30 days.
  await db.posting.updateMany({ where: { source: "VENTUREFIZZ", closedAt: null, lastSeenAt: { lt: hoursAgo(24 * 30) } }, data: { closedAt: now } });
}
