// Builds the Today view from stored data. No network.
import { db } from "@/lib/db";
import { cardState, tierFor, relativeLabel } from "@/services/leads/rules";
import { TIER_LABELS } from "@/config/tiers";
import { currentProgress } from "@/services/refresh";
import type { TodayView, LeadCard } from "@/contracts/views";
import { worthALook, todaysHoroscope } from "@/services/industry";
import { storedFits } from "@/services/applying/fit";

const RECENT_CHANGE_DAYS = 14;
const STALE_IMPORT_DAYS = 30;

async function cards(): Promise<{ cards: LeadCard[]; changes: Awaited<ReturnType<typeof recentChanges>> }> {
  const [companies, applied, changes] = await Promise.all([
    db.company.findMany({
      where: { excludedAt: null, OR: [{ people: { some: {} } }, { postings: { some: { source: "MANUAL" } } }], postings: { some: { closedAt: null } } },
      include: {
        postings: { where: { closedAt: null } },
        people: true,
        reviews: { orderBy: { reviewedAt: "desc" }, take: 1 },
      },
    }),
    db.application.findMany({ select: { postingId: true } }),
    recentChanges(),
  ]);
  const appliedIds = new Set(applied.map((a) => a.postingId));
  const allIds = companies.flatMap((c) => c.postings.map((p) => p.id));
  const [fits, letters] = await Promise.all([storedFits(allIds), db.coverLetter.findMany({ where: { postingId: { in: allIds } }, select: { postingId: true } })]);
  const withLetter = new Set(letters.map((l) => l.postingId));
  const changeByPerson = new Map(changes.map((c) => [c.personId, c]));

  const out: (LeadCard & { newest: number })[] = [];
  for (const c of companies) {
    const reviewedIds = c.reviews[0] ? (c.reviews[0].postingIds as string[]) : null;
    const state = cardState(c.postings.map((p) => p.id), reviewedIds, appliedIds);
    if (!state.visible) continue;
    const jobs = c.postings
      .filter((p) => state.jobs.includes(p.id))
      .map((p) => ({ p, at: (p.postedAt ?? p.firstSeenAt).getTime() }))
      .sort((a, b) => b.at - a.at);
    out.push({
      newest: jobs[0]?.at ?? 0,
      companyId: c.id,
      companyName: c.name,
      pulse: null, // slice 3
      newSinceReview: state.newSinceReview,
      jobs: jobs.map(({ p }) => ({
        id: p.id,
        title: p.title,
        location: p.location,
        isRemote: p.isRemote,
        roleType: p.roleType,
        compensation: p.compensation,
        url: p.url,
        postedLabel: p.postedAt ? `Posted ${relativeLabel(p.postedAt)}` : `First seen ${relativeLabel(p.firstSeenAt)}`,
        source: p.source,
        addedByUser: p.source === "MANUAL",
        fit: (fits.get(p.id) as never) ?? null,
        hasCoverLetter: withLetter.has(p.id),
        filterWarnings: [],
      })),
      people: c.people
        .map((person) => {
          const tier = tierFor(person.title);
          const change = changeByPerson.get(person.id);
          const note = !change ? null
            : change.fromCompany && change.fromCompany !== change.toCompany ? `Just joined from ${change.fromCompany}`
            : change.fromTitle ? `Promoted from ${change.fromTitle}` : null;
          return {
            personId: person.id,
            name: `${person.firstName} ${person.lastName}`.trim(),
            title: person.title,
            tier,
            tierLabel: TIER_LABELS[tier],
            connectedLabel: `Connected ${relativeLabel(person.connectedOn)}`,
            note,
            connectedAt: person.connectedOn.getTime(),
          };
        })
        .sort((a, b) => a.tier - b.tier || b.connectedAt - a.connectedAt)
        .map(({ connectedAt: _drop, ...rest }) => rest),
    });
  }
  out.sort((a, b) => b.newest - a.newest);
  return { cards: out.map(({ newest: _n, ...rest }) => rest), changes };
}

async function recentChanges() {
  const since = new Date(Date.now() - RECENT_CHANGE_DAYS * 864e5);
  const latestImport = await db.import.findFirst({ orderBy: { importedAt: "desc" } });
  if (!latestImport || latestImport.importedAt < since) return [];
  const rows = await db.connectionChange.findMany({
    where: { toImportId: latestImport.id, dismissedAt: null },
    include: { person: true },
  });
  const prior = await db.import.findUnique({ where: { id: rows[0]?.fromImportId ?? "" } });
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return rows.map((r) => ({
    personId: r.personId,
    name: `${r.person.firstName} ${r.person.lastName}`.trim(),
    fromCompany: r.fromCompany,
    toCompany: r.toCompany,
    fromTitle: r.fromTitle,
    toTitle: r.toTitle,
    companyId: r.person.companyId,
    betweenLabel: prior ? `changed between your ${fmt(prior.importedAt)} and ${fmt(latestImport.importedAt)} imports` : "since your last import",
  }));
}

export async function countNewLeads(): Promise<number> {
  return (await cards()).cards.length;
}

export async function buildToday(): Promise<TodayView & { people: Record<string, string | null> }> {
  const [{ cards: leads, changes }, lastImport, lastRun, horoscope] = await Promise.all([
    cards(),
    db.import.findFirst({ orderBy: { importedAt: "desc" } }),
    db.refreshRun.findFirst({ orderBy: { startedAt: "desc" } }),
    todaysHoroscope(),
  ]);
  const progress = currentProgress();
  const onCard = new Set(leads.map((l) => l.companyId));
  const staleDays = lastImport ? Math.floor((Date.now() - lastImport.importedAt.getTime()) / 864e5) : null;
  return {
    refresh: {
      state: progress?.state === "RUNNING" ? "RUNNING" : lastRun ? (lastRun.status === "stopped-at-cap" ? "STOPPED_AT_CAP" : "DONE") : "IDLE",
      checked: progress?.state === "RUNNING" ? progress.checked : 0,
      total: progress?.state === "RUNNING" ? progress.total : 0,
      finishedAt: lastRun?.finishedAt?.toISOString() ?? null,
      newLeadCount: leads.length,
    },
    staleImportDays: staleDays !== null && staleDays > STALE_IMPORT_DAYS ? staleDays : null,
    firstRun: !lastImport,
    horoscopes: horoscope ? [horoscope] : [],
    recentlySwitched: changes
      .filter((c) => c.fromCompany !== c.toCompany && !(c.companyId && onCard.has(c.companyId)))
      .slice(0, 5)
      .map(({ personId, name, fromCompany, toCompany, betweenLabel }) => ({ personId, name, fromCompany, toCompany, betweenLabel })),
    leads,
    worthALook: (await worthALook(onCard)).map((w) => ({ ...w, type: w.type as "FUNDING" | "LAUNCH" | "LEADERSHIP_HIRE" | "EXPANSION" | null })),
    people: {},
  };
}
