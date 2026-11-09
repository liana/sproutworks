// Companies where the user knows people but whose careers pages the app can't read.
import { db } from "@/lib/db";
import { tierFor } from "@/services/leads/rules";
import { TIER_LABELS } from "@/config/tiers";

export const WATCHLIST_RETURN_DAYS = 30;
const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export async function buildWatchlist() {
  const companies = await db.company.findMany({
    where: { boardStatus: "NONE", excludedAt: null, people: { some: {} } },
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
    const people = c.people.map((p) => ({ p, tier: tierFor(p.title) })).sort((a, b) => a.tier - b.tier);
    const best = people[0];
    return {
      companyId: c.id, companyName: c.name, peopleCount: c.people.length,
      bestIntro: best ? { name: `${best.p.firstName} ${best.p.lastName}`, title: best.p.title, tierLabel: TIER_LABELS[best.tier], tier: best.tier } : null,
      careersUrl: c.careersUrl,
      searchUrl: `https://duckduckgo.com/?q=${encodeURIComponent(`${c.name} careers`)}`,
      lastReviewedLabel: reviewed ? `Last reviewed ${fmt(reviewed)}` : null,
      backBecause, visible, isNew: !reviewed,
    };
  });
  return rows.filter((r) => r.visible).sort((a, b) => Number(!!b.backBecause) - Number(!!a.backBecause) || (a.bestIntro?.tier ?? 3) - (b.bestIntro?.tier ?? 3));
}

export const reviewWatchlistCompany = (id: string) => db.company.update({ where: { id }, data: { watchlistReviewedAt: new Date() } });
export const undoWatchlistReview = (id: string) => db.company.update({ where: { id }, data: { watchlistReviewedAt: null } });
