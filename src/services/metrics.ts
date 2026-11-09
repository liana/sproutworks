// Metrics: computed from stored data, never estimated by a model.
import { db } from "@/lib/db";
import { WEEKLY_BUDGET_USD } from "@/config/models";

const WEEK = 7 * 864e5;
const weekIndex = (d: Date, now: number) => Math.floor((now - d.getTime()) / WEEK); // 0 = this week
const round1 = (n: number) => Math.round(n * 10) / 10;

function series(points: { at: Date; value: number }[], now: number, mode: "avg" | "sum"): (number | null)[] {
  const buckets: number[][] = Array.from({ length: 8 }, () => []);
  for (const p of points) { const w = weekIndex(p.at, now); if (w >= 0 && w < 8) buckets[w].push(p.value); }
  return buckets.map((b) => (b.length ? round1(mode === "avg" ? b.reduce((a, c) => a + c, 0) / b.length : b.reduce((a, c) => a + c, 0)) : null)).reverse(); // oldest → newest
}

export async function buildMetrics() {
  const now = Date.now();
  const since = new Date(now - 8 * WEEK);
  const [apps, events, reviews, fits, letters, runs, spend, firstImport, companiesKnown, confirmed, postings] = await Promise.all([
    db.application.findMany(),
    db.appEvent.findMany({ where: { at: { gte: since }, type: { in: ["TODAY_OPENED", "ALL_CAUGHT_UP"] } }, orderBy: { at: "asc" } }),
    db.review.findMany({ where: { reviewedAt: { gte: since } } }),
    db.fitCheck.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.coverLetter.findMany({ select: { createdAt: true } }),
    db.refreshRun.findMany({ where: { startedAt: { gte: since }, finishedAt: { not: null } } }),
    db.aiCall.aggregate({ _sum: { costMicroUsd: true }, where: { createdAt: { gte: new Date(now - WEEK) } } }),
    db.import.findFirst({ orderBy: { importedAt: "asc" } }),
    db.company.count({ where: { people: { some: {} }, excludedAt: null } }),
    db.company.count({ where: { people: { some: {} }, excludedAt: null, boardStatus: "CONFIRMED" } }),
    db.posting.findMany({ where: { firstSeenAt: { gte: since } }, select: { id: true, companyId: true, firstSeenAt: true } }),
  ]);

  // Sweep: first "Today opened" to the next "All caught up" on the same day.
  const sweeps: { at: Date; value: number }[] = [];
  const byDay = new Map<string, typeof events>();
  for (const e of events) { const k = e.at.toDateString(); byDay.set(k, [...(byDay.get(k) ?? []), e]); }
  for (const list of byDay.values()) {
    const open = list.find((e) => e.type === "TODAY_OPENED");
    const done = open && list.find((e) => e.type === "ALL_CAUGHT_UP" && e.at > open.at);
    if (open && done) sweeps.push({ at: open.at, value: (done.at.getTime() - open.at.getTime()) / 6e4 });
  }
  const firstSeen = new Map(postings.map((p) => [p.id, p.firstSeenAt]));
  const waits = reviews.flatMap((r) => (r.postingIds as string[]).map((id) => firstSeen.get(id)).filter((d): d is Date => !!d && d < r.reviewedAt).map((d) => ({ at: r.reviewedAt, value: (r.reviewedAt.getTime() - d.getTime()) / 864e5 })));
  const leadsWeekly = series(Object.values(Object.fromEntries(postings.filter((p) => p.companyId).map((p) => [`${p.companyId}-${weekIndex(p.firstSeenAt, now)}`, { at: p.firstSeenAt, value: 1 }]))), now, "sum");
  const outreachWeekly = series([...fits.map((f) => ({ at: f.createdAt, value: 1 })), ...letters.filter((l) => l.createdAt >= since).map((l) => ({ at: l.createdAt, value: 1 })), ...apps.filter((a) => a.appliedAt >= since).map((a) => ({ at: a.appliedAt, value: 1 }))], now, "sum");
  const checkSeries = series(runs.map((r) => ({ at: r.startedAt, value: (r.finishedAt!.getTime() - r.startedAt.getTime()) / 6e4 })), now, "avg");
  const failSeries = series(runs.map((r) => ({ at: r.startedAt, value: r.requestsMade ? ((r.failures as unknown[]).length / r.requestsMade) * 100 : 0 })), now, "avg");
  const weeksSinceStart = firstImport ? Math.min(4, Math.floor((now - firstImport.importedAt.getTime()) / WEEK) + 1) : 0;
  const reached = apps.filter((a) => a.reachedInterview || a.stage === "INTERVIEWING" || a.stage === "WON").length;
  const n = (s: string) => apps.filter((a) => a.stage === s).length;

  return {
    outcomes: {
      applications: apps.length, active: n("APPLIED") + n("INTERVIEWING"),
      interviewRate: apps.length ? Math.round((reached / apps.length) * 100) : 0, reached,
      won: n("WON"),
    },
    sweep: { value: series(sweeps, now, "avg").at(-1), trend: series(sweeps, now, "avg") },
    toReview: { value: series(waits, now, "avg").at(-1), trend: series(waits, now, "avg") },
    warmLeads: { value: leadsWeekly.at(-1) ?? 0, baselineWeek: weeksSinceStart },
    outreach: { value: outreachWeekly.at(-1) ?? 0, baselineWeek: weeksSinceStart },
    check: { value: checkSeries.at(-1), trend: checkSeries },
    failures: { value: failSeries.at(-1), trend: failSeries },
    spend: { usd: (spend._sum.costMicroUsd ?? 0) / 1e6, budget: WEEKLY_BUDGET_USD },
    accuracy: { falseResurfaces: runs.reduce((a, r) => a + r.falseResurfaces, 0), letters: letters.length },
    coverage: { readable: confirmed, total: companiesKnown },
  };
}
