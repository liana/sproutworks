// Feeds, Market Pulse, and the horoscope: fetched once a day with the morning check.
import { db } from "@/lib/db";
import type { Fetcher } from "@/lib/fetch/polite";
import { FETCH } from "@/config/fetch";
import { SEED_SOURCES, TITLE_EXCLUDES, STALE_FEED_DAYS, NEWS_WINDOW_DAYS, AI_ONLY } from "@/config/sources";
import { parseFeed, isStale, matchesPath, isAiStory } from "@/services/feeds/parse";
import { virgoFromAstrostyle } from "@/services/feeds/horoscope";
import { tagHeadline } from "@/services/pulse/rules";
import { normalizeCompanyName } from "@/services/companies/normalize";

// Adds any starter source not yet in the database. A source the user removed stays removed.
export async function ensureSeedSources(): Promise<void> {
  const known = new Set((await db.source.findMany({ select: { url: true } })).map((s) => s.url));
  for (const s of SEED_SOURCES.filter((x) => !known.has(x.url))) {
    await db.source.create({
      data: {
        list: s.list, type: s.type, name: s.name, url: s.url, feedUrl: s.feedUrl ?? null, category: s.category ?? null, color: s.color ?? null,
        pathFilter: s.pathFilter ?? null, showSummary: s.showSummary ?? true, robotsAllowed: s.type !== "LINK_OUT",
        termsConfirmedAt: s.termsConfirmed ? new Date() : null, confirmedAt: new Date(),
      },
    });
  }
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export async function refreshFeeds(fetcher: Fetcher, failures: { company: string; status: number }[]): Promise<void> {
  await ensureSeedSources();
  const sources = await db.source.findMany({
    where: {
      removedAt: null, termsConfirmedAt: { not: null }, feedUrl: { not: null }, type: { in: ["NEWS_RSS", "HOROSCOPE"] },
      OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: new Date(Date.now() - FETCH.minHoursBetweenFetches * 36e5) } }],
    },
  });
  const companies = await db.company.findMany({ where: { people: { some: {} } }, select: { id: true, normalizedName: true } });
  const byName = new Map(companies.map((c) => [c.normalizedName, c.id]));
  const since = Date.now() - NEWS_WINDOW_DAYS * 864e5;

  for (const src of sources) {
    const res = await fetcher(src.feedUrl!, { etag: src.etag });
    if (res.status === 304) { await db.source.update({ where: { id: src.id }, data: { lastFetchedAt: new Date() } }); continue; }
    if (res.status !== 200 || typeof res.body !== "string") { failures.push({ company: `${src.name} feed`, status: res.status }); continue; }
    let items;
    try { items = parseFeed(res.body); } catch { failures.push({ company: `${src.name} feed (unreadable)`, status: 200 }); continue; }
    const stale = isStale(items, STALE_FEED_DAYS);
    await db.source.update({
      where: { id: src.id },
      data: { lastFetchedAt: new Date(), etag: res.etag, staleSince: stale ? src.staleSince ?? new Date() : null },
    });

    if (src.type === "HOROSCOPE") {
      const reading = virgoFromAstrostyle(items);
      if (reading) {
        await db.horoscope.upsert({
          where: { date_sourceId: { date: startOfToday(), sourceId: src.id } },
          update: { text: reading.text, url: reading.url },
          create: { date: startOfToday(), sourceId: src.id, text: reading.text, url: reading.url },
        });
      }
      continue;
    }

    const exclude = TITLE_EXCLUDES[src.name];
    for (const it of items) {
      if (!it.publishedAt || it.publishedAt.getTime() < since) continue;
      if (!matchesPath(it.url, src.pathFilter) || exclude?.test(it.title)) continue;
      if (AI_ONLY.has(src.name) && !isAiStory(it)) continue;
      const exists = await db.newsItem.findUnique({ where: { url: it.url } });
      if (exists) continue;
      const tag = tagHeadline(it.title);
      const companyId = tag.companyName ? byName.get(normalizeCompanyName(tag.companyName)) ?? null : null;
      await db.newsItem.create({
        data: {
          sourceId: src.id, url: it.url, title: it.title, summary: src.showSummary ? it.summary : null, imageUrl: it.imageUrl,
          category: tag.type ? "PULSE" : src.category ?? "DIGITAL_HEALTH", isAi: isAiStory(it), publishedAt: it.publishedAt,
          pulse: tag.type ? { create: { type: tag.type, companyName: tag.companyName, companyId, amount: tag.amount, round: tag.round } } : undefined,
        },
      });
    }
  }
}
