// RSS 2.0 and Atom → feed items. Pure. Titles and descriptions are read raw because some feeds put HTML inside them.
import { XMLParser } from "fast-xml-parser";

export type FeedItem = { url: string; title: string; summary: string | null; imageUrl: string | null; publishedAt: Date | null; categories: string[]; contentHtml: string };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  stopNodes: ["*.title", "*.description", "*.summary", "*.content:encoded", "*.content", "*.dc:creator"],
  processEntities: true,
  htmlEntities: true,
});

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#8211": "–", "#8212": "—", "#8217": "’", "#8216": "‘", "#8220": "“", "#8221": "”", "#8230": "…", "#038": "&", "#39": "'" };

export function stripHtml(raw: unknown): string {
  if (typeof raw !== "string") return raw == null ? "" : String((raw as { "#text"?: string })["#text"] ?? "");
  const once = decodeOnce(raw);
  return /&(#x?[0-9a-f]+|[a-z]+);/i.test(once) ? decodeOnce(once) : once; // some feeds double-escape ("&amp;amp;")
}

function decodeOnce(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (ENTITIES[e.toLowerCase()]) return ENTITIES[e.toLowerCase()];
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
      return m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

// RFC 822 and ISO dates, plus Fierce's "Jan 23, 2026 4:20pm".
export function parseFeedDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim().replace(/(\d)(am|pm)$/i, "$1 $2");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function imageFrom(item: Record<string, unknown>): string | null {
  const media = arr(item["media:content"] as Record<string, string> | Record<string, string>[]).find((m) => m?.["@url"] && (!m["@medium"] || m["@medium"] === "image"));
  if (media) return media["@url"];
  const thumb = arr(item["media:thumbnail"] as Record<string, string> | Record<string, string>[])[0];
  if (thumb?.["@url"]) return thumb["@url"];
  const enc = arr(item.enclosure as Record<string, string> | Record<string, string>[]).find((e) => /^image\//.test(e?.["@type"] ?? ""));
  if (enc) return enc["@url"];
  const html = String(item["content:encoded"] ?? item.description ?? "");
  return html.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (doc.rss?.channel) {
    return arr(doc.rss.channel.item).map((it: Record<string, unknown>) => ({
      url: stripHtml(it.link).trim() || stripHtml((it.guid as Record<string, string>)?.["#text"] ?? it.guid),
      title: stripHtml(it.title),
      summary: stripHtml(it.description) || null,
      imageUrl: imageFrom(it),
      publishedAt: parseFeedDate(it.pubDate ?? it["dc:date"]),
      categories: arr(it.category as string | string[]).map(stripHtml).filter(Boolean),
      contentHtml: String(it["content:encoded"] ?? "").replace(/^<!\[CDATA\[|\]\]>$/g, ""),
    })).filter((i) => i.url && i.title);
  }
  if (doc.feed) {
    return arr(doc.feed.entry).map((e: Record<string, unknown>) => {
      const links = arr(e.link as Record<string, string> | Record<string, string>[]);
      const href = (links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0])?.["@href"] ?? "";
      return {
        url: href,
        title: stripHtml(e.title),
        summary: stripHtml(e.summary ?? e.content) || null,
        imageUrl: imageFrom(e),
        publishedAt: parseFeedDate(e.published ?? e.updated),
        categories: arr(e.category as Record<string, string> | Record<string, string>[]).map((c) => c["@term"]).filter(Boolean),
        contentHtml: String(e.content ?? ""),
      };
    }).filter((i) => i.url && i.title);
  }
  throw new Error("Not an RSS or Atom feed.");
}

export function newestDate(items: FeedItem[]): Date | null {
  return items.reduce<Date | null>((max, i) => (i.publishedAt && (!max || i.publishedAt > max) ? i.publishedAt : max), null);
}

export function isStale(items: FeedItem[], staleDays: number, now = new Date()): boolean {
  const newest = newestDate(items);
  return !newest || now.getTime() - newest.getTime() > staleDays * 864e5;
}

export function matchesPath(url: string, pathFilter: string | null): boolean {
  if (!pathFilter) return true;
  return pathFilter.split(",").map((p) => p.trim()).filter(Boolean).some((p) => url.includes(p));
}

const AI = /\b(ai|a\.i\.|artificial intelligence|machine learning|llms?|generative|genai|chatbots?|agents?|agentic|openai|anthropic|claude|gpt|gemini)\b/i;
export const isAiStory = (i: Pick<FeedItem, "title" | "categories">) => AI.test(i.title) || i.categories.some((c) => /artificial intelligence|^ai$/i.test(c));
