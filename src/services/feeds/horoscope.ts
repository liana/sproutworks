// Astrostyle (The AstroTwins): the Virgo reading from the newest dated daily post. Pure.
import { stripHtml } from "./parse.ts";

export type Reading = { text: string; postedAt: Date; url: string };
const SIGN_PAGE = "https://astrostyle.com/horoscopes/daily/virgo/";

export function virgoFromAstrostyle(items: { title: string; publishedAt: Date | null; contentHtml: string }[], now = new Date()): Reading | null {
  const daily = items
    .filter((i) => /^daily horoscopes? for /i.test(i.title) && i.publishedAt && now.getTime() - i.publishedAt.getTime() < 50 * 36e5 /* weekend posts cover two days */)
    .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime())[0];
  if (!daily) return null;
  const html = daily.contentHtml;
  const start = html.search(/<h3[^>]*>\s*Virgo\b[^<]*daily horoscope/i);
  if (start === -1) return null;
  const afterHeading = html.slice(html.indexOf("</h3>", start) + 5);
  const end = afterHeading.search(/<h3|<figure/i);
  const text = stripHtml((end === -1 ? afterHeading : afterHeading.slice(0, end)).match(/<p[\s\S]*?<\/p>/gi)?.join(" ") ?? "");
  return text ? { text, postedAt: daily.publishedAt!, url: SIGN_PAGE } : null;
}

// The strip shows the opening; "Read more" goes to the full reading.
export function firstSentences(text: string, n = 3): string {
  const parts = text.match(/[^.!?]+[.!?]+["”’]?(\s|$)/g) ?? [text];
  return parts.slice(0, n).join("").trim();
}
