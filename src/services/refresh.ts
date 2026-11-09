// The once-a-day morning check: resolve job boards, fetch confirmed ones, record postings.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { FETCH } from "@/config/fetch";
import { createPoliteFetcher, RequestCapReached, type Fetcher } from "@/lib/fetch/polite";
import { fetchBoard, type Provider, type BoardPosting } from "@/services/boards/adapters";
import { boardCodeCandidates } from "@/services/companies/normalize";
import { classifyJob, closuresAllowed } from "@/services/leads/rules";

const PROVIDERS: Provider[] = ["GREENHOUSE", "LEVER", "ASHBY"];

type Progress = { runId: string; checked: number; total: number; state: "RUNNING" | "DONE" | "STOPPED_AT_CAP" };
const g = globalThis as unknown as { sproutRefresh?: Progress };
export const currentProgress = (): Progress | null => g.sproutRefresh ?? null;

// Development without real data: SPROUT_FIXTURE_BOARDS=1 serves recorded responses from test/fixtures/boards.
function fixtureFetcher(): Fetcher {
  return async (url) => {
    const host = new URL(url).host;
    const provider = host.includes("greenhouse") ? "greenhouse" : host.includes("lever") ? "lever" : "ashby";
    const code = decodeURIComponent(url.match(/(?:boards|postings|job-board)\/([^/?]+)/)?.[1] ?? "");
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
      if (company.boardStatus === "UNKNOWN") await probe(company.id, company.name, fetcher);
      else await fetchConfirmed(company.id, company.name, company.boardProvider as Provider, company.boardCode!, company.etag, company.lastJobCount, fetcher, failures);
    } catch (e) {
      if (e instanceof RequestCapReached) { stoppedAtCap = true; skipped.push(...companies.slice(progress.checked).map((c) => c.name)); break; }
      failures.push({ company: company.name, status: -1 });
    }
    progress.checked++;
  }

  progress.state = stoppedAtCap ? "STOPPED_AT_CAP" : "DONE";
  const { countNewLeads } = await import("@/services/today");
  await db.refreshRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), status: stoppedAtCap ? "stopped-at-cap" : "done", requestsMade: polite.requestsMade(), newLeadCount: await countNewLeads(), skipped, failures },
  });
}

async function probe(companyId: string, name: string, fetcher: Fetcher) {
  for (const code of boardCodeCandidates(name)) {
    for (const provider of PROVIDERS) {
      const r = await fetchBoard(provider, code, fetcher);
      if (r.kind === "ok" && r.postings.length > 0) {
        const sample = r.postings.find((p) => classifyJob(p).qualifies) ?? r.postings[0];
        await db.company.update({
          where: { id: companyId },
          data: { boardStatus: "PENDING", boardProvider: provider, boardCode: code, lastProbedAt: new Date(), probeJobCount: r.postings.length, probeSampleTitle: sample.title },
        });
        return;
      }
    }
  }
  await db.company.update({ where: { id: companyId }, data: { boardStatus: "NONE", lastProbedAt: new Date() } });
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
    await db.company.update({ where: { id: companyId }, data: { lastFetchedAt: now, emptyOrMissingDays: { increment: 1 } } });
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
