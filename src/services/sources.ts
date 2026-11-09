// Add-a-source flow: detect a feed, check robots.txt and freshness, then save as fetched or link-only.
import { db } from "@/lib/db";
import { createPoliteFetcher } from "@/lib/fetch/polite";
import { parseFeed, isStale, newestDate } from "@/services/feeds/parse";
import { robotsAllows } from "@/services/feeds/robots";
import { STALE_FEED_DAYS, LINK_CHECK_DAYS } from "@/config/sources";
import type { SourcePreview } from "@/contracts/views";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export async function previewSource(url: string): Promise<SourcePreview> {
  const base: SourcePreview = { url, detectedType: "NONE", feedUrl: null, itemCount: null, robotsAllowed: false, fetchable: false, newestLabel: null, stale: false, error: null };
  let u: URL;
  try { u = new URL(url); } catch { return { ...base, error: "That isn't a valid URL." }; }
  if (/(^|\.)linkedin\.com$/i.test(u.hostname)) return { ...base, error: "LinkedIn URLs aren't allowed as sources." };
  const { fetcher } = createPoliteFetcher({ maxRequestsPerRefresh: 4, perHostDelayMs: 0 });

  const robots = await fetcher(`${u.origin}/robots.txt`);
  const robotsTxt = typeof robots.body === "string" ? robots.body : "";
  const page = await fetcher(url);
  if (page.status !== 200 || typeof page.body !== "string") return { ...base, error: `The site answered with status ${page.status || "no response"}. Saved sources need a page that loads.` };

  let feedUrl: string | null = null; let xml: string | null = null;
  if (/^\s*<\?xml|<rss|<feed/i.test(page.body.slice(0, 500))) { feedUrl = url; xml = page.body; }
  else {
    const link = page.body.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[0];
    const href = link?.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) {
      feedUrl = new URL(href, url).toString();
      const f = await fetcher(feedUrl);
      if (f.status === 200 && typeof f.body === "string") xml = f.body;
    }
  }
  const robotsAllowed = robotsAllows(robotsTxt, new URL(feedUrl ?? url).pathname);
  if (!xml) return { ...base, robotsAllowed };
  try {
    const items = parseFeed(xml);
    const newest = newestDate(items);
    const stale = isStale(items, STALE_FEED_DAYS);
    return { ...base, detectedType: "NEWS_RSS", feedUrl, itemCount: items.length, robotsAllowed, newestLabel: newest ? fmt(newest) : null, stale, fetchable: robotsAllowed && !stale };
  } catch {
    return { ...base, robotsAllowed, error: "Found a feed link, but the feed couldn't be read." };
  }
}

export async function addSource(input: { list: "NEWS" | "LEADS"; url: string; category?: "AI" | "DIGITAL_HEALTH" | "PULSE"; termsConfirmed: boolean }) {
  const p = await previewSource(input.url); // re-checked server-side; the client's preview isn't trusted
  if (p.error) throw new Error(p.error);
  if (p.stale) throw new Error(`This feed hasn't posted since ${p.newestLabel ?? "a long time ago"}. Stale feeds aren't saved.`);
  const fetched = p.fetchable && input.termsConfirmed;
  const host = new URL(input.url).hostname.replace(/^www\./, "");
  return db.source.upsert({
    where: { url: input.url },
    update: { removedAt: null },
    create: {
      list: input.list,
      type: fetched ? (input.list === "LEADS" ? "JOB_AGGREGATOR_RSS" : "NEWS_RSS") : "LINK_OUT",
      url: input.url, feedUrl: p.feedUrl, name: host, category: input.category ?? (input.list === "NEWS" ? "AI" : null),
      robotsAllowed: p.robotsAllowed, termsConfirmedAt: fetched ? new Date() : null, confirmedAt: new Date(),
    },
  });
}

export const removeSource = (id: string) => db.source.update({ where: { id }, data: { removedAt: new Date() } });
export const visitSource = (id: string) => db.source.update({ where: { id }, data: { lastVisitedAt: new Date() } });
export const keepSource = (id: string) => db.source.update({ where: { id }, data: { confirmedAt: new Date() } });

export async function listSources() {
  const rows = await db.source.findMany({ where: { removedAt: null }, orderBy: [{ list: "asc" }, { name: "asc" }] });
  const now = Date.now();
  const days = (d: Date | null) => (d ? (now - d.getTime()) / 864e5 : Infinity);
  return rows.map((s) => {
    const linkOnly = s.type === "LINK_OUT";
    const status =
      s.staleSince ? "Stale feed?" :
      linkOnly && days(s.confirmedAt) > LINK_CHECK_DAYS ? "Still useful?" :
      linkOnly && days(s.lastVisitedAt ?? s.confirmedAt) > LINK_CHECK_DAYS ? "Unused for 30 days" :
      linkOnly ? "Link only" : s.type === "JOB_AGGREGATOR_RSS" ? "Saved (read in a later slice)" : s.type === "HOROSCOPE" ? "Horoscope" : "Fetched";
    return {
      id: s.id, list: s.list, name: s.name, url: s.url, status,
      detail: linkOnly ? (s.lastVisitedAt ? `last visited ${fmt(s.lastVisitedAt)}` : "not visited yet") : s.lastFetchedAt ? `read ${fmt(s.lastFetchedAt)}` : "not read yet",
    };
  });
}
