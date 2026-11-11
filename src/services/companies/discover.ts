// Find a company's careers page from its homepage: follow the Careers or Jobs link, then see where it leads. Pure.
import type { Fetcher } from "../../lib/fetch/polite.ts";
import { robotsAllows } from "../feeds/robots.ts";
import { boardInText } from "../boards/probe.ts";
import { workdayInText } from "../boards/workday.ts";

const LINK_TEXT = /^(careers?|jobs|join (us|our team)|work (with|at) us|open (roles|positions)|we'?re hiring|current openings)$/i;
const LINK_HREF = /\/(careers?|jobs|join-us|work-with-us|opportunities)(\/|$|\?|#)|^https?:\/\/(careers|jobs)\./i;

export function careersLinkIn(html: string, base: string): string | null {
  let byHref: string | null = null;
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || /^(mailto|javascript|tel):|^#/i.test(href)) continue;
    let url: string;
    try { url = new URL(href.replace(/&amp;/g, "&"), base).toString(); } catch { continue; }
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (LINK_TEXT.test(text)) return url; // the clearest signal: the link says "Careers"
    if (!byHref && LINK_HREF.test(url)) byHref = url;
  }
  return byHref;
}

export type Discovery = { url: string } | null;

// Homepage → its careers link → the page there. Returns the most specific address found:
// a job board or Workday site linked from the careers page, else the careers page itself.
export async function discoverCareersPage(website: string, fetcher: Fetcher): Promise<Discovery> {
  const origin = new URL(website).origin;
  const robots = await fetcher(`${origin}/robots.txt`);
  const rules = robots.status === 200 && typeof robots.body === "string" ? robots.body : "";
  const allowed = (url: string) => new URL(url).origin !== origin || robotsAllows(rules, new URL(url).pathname);

  const home = allowed(website) ? await fetcher(website) : null;
  const homeHtml = home && typeof home.body === "string" ? home.body : "";
  const link = careersLinkIn(homeHtml, home?.finalUrl ?? website);
  if (!link) return null;
  if (boardInText(link) || workdayInText(link)) return { url: link };
  if (!allowed(link)) return { url: link };
  const page = await fetcher(link);
  if (page.status !== 200) return null;
  const finalUrl = page.finalUrl ?? link;
  if (boardInText(finalUrl) || workdayInText(finalUrl)) return { url: finalUrl };
  const html = typeof page.body === "string" ? page.body : "";
  return { url: workdayInText(html) ?? finalUrl };
}
