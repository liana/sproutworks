// Companies where the user knows people but whose careers pages the app can't read.
import { db } from "@/lib/db";
import { tierFor } from "@/services/leads/rules";
import { TIER_LABELS } from "@/config/tiers";
import type { WatchlistRow } from "@/contracts/views";

export const WATCHLIST_RETURN_DAYS = 30;
const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const connectedFor = (d: Date) => {
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5));
  return years >= 1 ? `connected ${years} yr${years === 1 ? "" : "s"}` : "connected this year";
};

export async function buildWatchlist(): Promise<WatchlistRow[]> {
  const companies = await db.company.findMany({
    // A careers page the app reads every morning takes the company off the Watchlist; its jobs go to Today.
    where: { boardStatus: "NONE", excludedAt: null, people: { some: {} },
      // Spelled out with OR: a NOT over a nullable column drops the nulls in SQL.
      OR: [{ careersReadAs: null }, { careersReadAs: { notIn: ["WORKDAY", "LISTINGS", "TEXT"] } }] },
    include: {
      people: { include: { changes: { orderBy: { id: "desc" }, take: 1, include: { person: false } } } },
      pulseEvents: { where: { type: { not: null } }, include: { newsItem: true } },
    },
    orderBy: { name: "asc" },
  });
  const changes = await db.connectionChange.findMany({ include: { person: true } });
  const imports = new Map((await db.import.findMany()).map((i) => [i.id, i.importedAt]));
  const rows = companies.map((c) => {
    const reviewed = c.watchlistReviewedAt;
    let backBecause: string | null = null;
    let visible = !reviewed;
    if (reviewed) {
      const news = c.pulseEvents.find((e) => (e.newsItem.publishedAt ?? e.newsItem.fetchedAt) > reviewed);
      const change = changes.find((ch) => (ch.person.companyId === c.id || ch.fromCompany === c.name) && (imports.get(ch.toImportId) ?? new Date(0)) > reviewed);
      if (news) backBecause = news.newsItem.title;
      else if (change) backBecause = `${change.person.firstName} ${change.person.lastName}: ${change.fromCompany ?? "?"} → ${change.toCompany ?? "?"}`;
      else if (Date.now() - reviewed.getTime() > WATCHLIST_RETURN_DAYS * 864e5) backBecause = `${WATCHLIST_RETURN_DAYS} days since you reviewed it`;
      visible = !!backBecause;
    }
    const people = c.people
      .map((p) => ({ p, tier: tierFor(p.title) }))
      .sort((a, b) => a.tier - b.tier || a.p.connectedOn.getTime() - b.p.connectedOn.getTime())
      .map(({ p, tier }) => ({
        id: p.id, name: `${p.firstName} ${p.lastName}`, initials: `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase(),
        title: p.title, tier, tierLabel: TIER_LABELS[tier], connectedLabel: connectedFor(p.connectedOn),
      }));
    const news = c.pulseEvents
      .map((e) => e.newsItem)
      .sort((a, b) => (b.publishedAt ?? b.fetchedAt).getTime() - (a.publishedAt ?? a.fetchedAt).getTime())
      .slice(0, 3)
      .map((n) => ({ id: n.id, title: n.title, url: n.url, dateLabel: fmt(n.publishedAt ?? n.fetchedAt) }));
    return {
      companyId: c.id, companyName: c.name, peopleCount: c.people.length,
      bestIntro: people[0] ?? null, people, news,
      website: c.website, blurb: c.blurb, blurbSource: c.blurbSource === "WEBSITE" || c.blurbSource === "WIKIPEDIA" ? c.blurbSource : null, industry: c.industry, infoLooked: !!c.infoFetchedAt,
      careersUrl: c.careersUrl, careersFound: c.careersSource === "FOUND", careersUnreadable: c.careersReadAs === "UNREADABLE",
      searchUrl: `https://duckduckgo.com/?q=${encodeURIComponent(`${c.name} careers`)}`,
      lastReviewedLabel: reviewed ? `Last reviewed ${fmt(reviewed)}` : null,
      backBecause, visible,
    } satisfies WatchlistRow;
  });
  return rows.filter((r) => r.visible).sort((a, b) => Number(!!b.backBecause) - Number(!!a.backBecause) || (a.bestIntro?.tier ?? 3) - (b.bestIntro?.tier ?? 3));
}

export const reviewWatchlistCompany = (id: string) => db.company.update({ where: { id }, data: { watchlistReviewedAt: new Date() } });
export const undoWatchlistReview = (id: string) => db.company.update({ where: { id }, data: { watchlistReviewedAt: null } });
