import { db } from "@/lib/db";
import { NEWS_WINDOW_DAYS } from "@/config/sources";
import { firstSentences } from "@/services/feeds/horoscope";

export type Section = "all" | "ai" | "digital-health" | "pulse";
export type IndustryItem = {
  id: string; url: string; title: string; summary: string | null; imageUrl: string | null; source: string; color: string | null;
  publishedLabel: string; pulse: { type: string | null; amount: string | null; round: string | null } | null; knownPeople: number; tags: string[];
};

const PULSE_LABEL: Record<string, string> = { FUNDING: "Funding", LAUNCH: "Launch", LEADERSHIP_HIRE: "Leadership hire", EXPANSION: "Expansion" };

export async function buildIndustry(section: Section) {
  const since = new Date(Date.now() - NEWS_WINDOW_DAYS * 864e5);
  const where =
    section === "ai" ? { isAi: true } :
    section === "digital-health" ? { category: "DIGITAL_HEALTH" as const } :
    section === "pulse" ? { pulse: { type: { not: null } } } : {};
  const [items, sources] = await Promise.all([
    db.newsItem.findMany({
      where: { publishedAt: { gte: since }, source: { removedAt: null }, ...where },
      orderBy: { publishedAt: "desc" },
      take: 40,
      include: { source: true, pulse: { include: { company: { include: { _count: { select: { people: true } } } } } } },
    }),
    db.source.findMany({ where: { list: "NEWS", removedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    items: items.map<IndustryItem>((i) => {
      const tags = [i.source.name, i.isAi ? "AI" : null, i.category === "DIGITAL_HEALTH" ? "Digital health" : null,
        i.pulse?.type ? [PULSE_LABEL[i.pulse.type], i.pulse.amount, i.pulse.round].filter(Boolean).join(" ") : null].filter((t): t is string => !!t);
      return {
        id: i.id, url: i.url, title: i.title, summary: i.summary, imageUrl: i.imageUrl, source: i.source.name, color: i.source.color,
        publishedLabel: i.publishedAt ? fmt(i.publishedAt) : "", pulse: i.pulse ? { type: i.pulse.type, amount: i.pulse.amount, round: i.pulse.round } : null,
        knownPeople: i.pulse?.company?._count.people ?? 0, tags,
      };
    }),
    fetched: sources.filter((s) => s.type === "NEWS_RSS" && s.termsConfirmedAt).map((s) => s.name),
    linkOnly: sources.filter((s) => s.type === "LINK_OUT").map((s) => ({ id: s.id, name: s.name, url: s.url })),
  };
}

// Today's "Worth a look": Pulse events at companies where the user knows people and that have no lead card.
export async function worthALook(excludeCompanyIds: Set<string>) {
  const since = new Date(Date.now() - NEWS_WINDOW_DAYS * 864e5);
  const events = await db.pulseEvent.findMany({
    where: { type: { not: null }, companyId: { not: null }, newsItem: { publishedAt: { gte: since } }, company: { excludedAt: null, people: { some: {} } } },
    include: { newsItem: { include: { source: true } }, company: { include: { _count: { select: { people: true } } } } },
    orderBy: { newsItem: { publishedAt: "desc" } },
  });
  return events.filter((e) => !excludeCompanyIds.has(e.companyId!)).slice(0, 3).map((e) => ({
    headline: e.newsItem.title, url: e.newsItem.url, source: e.newsItem.source.name, type: e.type, amount: e.amount, round: e.round,
    knownPeople: e.company?._count.people ?? 0,
  }));
}

export async function todaysHoroscope() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const h = await db.horoscope.findFirst({ where: { date: start, source: { removedAt: null } }, include: { source: true } });
  return h ? { text: firstSentences(h.text, 3), url: h.url, source: h.source.name } : null;
}
