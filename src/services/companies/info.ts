// What a company does, from public sources only, deterministic, no AI: the company's own homepage
// description, then Wikidata (official website, industry) and the Wikipedia summary. Pure: the fetcher is passed in.
import type { Fetcher } from "../../lib/fetch/polite.ts";
import { normalizeCompanyName } from "./normalize.ts";
import { robotsAllows } from "../feeds/robots.ts";

export type CompanyInfo = { website: string | null; blurb: string | null; blurbSource: "WEBSITE" | "WIKIPEDIA" | null; industry: string | null };

// Hosts that belong to hiring tools or networks, never the company's own site.
const NOT_COMPANY_SITES = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workday\.com|icims\.com|smartrecruiters\.com|workable\.com|jobvite\.com|linkedin\.com|indeed\.com|wellfound\.com|duckduckgo\.com|google\.com)$/i;

// A careers URL on the company's own domain gives its homepage: careers.acme.com/jobs → https://acme.com/
export function homepageFrom(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^(www|careers|jobs|join|work)\./, "");
    if (NOT_COMPANY_SITES.test(host) || !host.includes(".")) return null;
    return `https://${host}/`;
  } catch { return null; }
}

const decode = (s: string) => s
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, " ").trim();

// The page's own summary of itself: <meta name="description"> or og:description.
export function metaDescription(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key !== "description" && key !== "og:description" && key !== "twitter:description") continue;
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
    const text = content ? decode(content) : "";
    if (text.length >= 20) return text;
  }
  return null;
}

// Two sentences at most, and never more than about 260 characters.
export function shorten(text: string, max = 260): string {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  let out = "";
  for (const s of sentences.slice(0, 2)) { if ((out + s).trim().length > max) break; out += s; }
  out = out.trim() || text.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return out;
}

const COMPANY_WORDS = /\b(company|companies|corporation|business|firm|startup|enterprise|manufacturer|provider|developer|platform|retailer|bank|insurer|publisher|maker|agency|subsidiary|conglomerate|organization|organisation)\b/i;

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" ? (v as J) : {});

// Wikidata's top hit counts only if its label is the company's name and its description says it's a business.
export function pickWikidataMatch(name: string, search: unknown): string | null {
  const want = normalizeCompanyName(name);
  const hits = Array.isArray(obj(search).search) ? (obj(search).search as J[]) : [];
  const hit = hits.find((h) => typeof h.label === "string" && normalizeCompanyName(h.label) === want && typeof h.description === "string" && COMPANY_WORDS.test(h.description));
  return typeof hit?.id === "string" ? hit.id : null;
}

export function readWikidataEntity(id: string, body: unknown): { website: string | null; industryIds: string[]; wikiTitle: string | null; description: string | null } {
  const e = obj(obj(obj(body).entities)[id]);
  const claims = obj(e.claims);
  const values = (p: string) => (Array.isArray(claims[p]) ? (claims[p] as J[]) : []).map((c) => obj(obj(c.mainsnak).datavalue).value);
  const site = values("P856").find((v) => typeof v === "string") as string | undefined;
  const industryIds = values("P452").map((v) => obj(v).id).filter((v): v is string => typeof v === "string").slice(0, 3);
  const title = obj(obj(e.sitelinks).enwiki).title;
  const description = obj(obj(e.descriptions).en).value;
  return { website: site ?? null, industryIds, wikiTitle: typeof title === "string" ? title : null, description: typeof description === "string" ? description : null };
}

const WD = "https://www.wikidata.org/w/api.php?format=json&";

export async function gatherCompanyInfo(name: string, careersUrl: string | null, fetcher: Fetcher): Promise<CompanyInfo> {
  let website = homepageFrom(careersUrl);
  let industry: string | null = null;
  let wikiTitle: string | null = null;

  const search = await fetcher(`${WD}action=wbsearchentities&type=item&language=en&limit=5&search=${encodeURIComponent(name)}`);
  const id = search.status === 200 ? pickWikidataMatch(name, search.body) : null;
  if (id) {
    const ent = await fetcher(`${WD}action=wbgetentities&props=claims|sitelinks|descriptions&sitefilter=enwiki&languages=en&ids=${id}`);
    if (ent.status === 200) {
      const d = readWikidataEntity(id, ent.body);
      website ??= homepageFrom(d.website);
      wikiTitle = d.wikiTitle;
      industry = d.description;
      if (d.industryIds.length) {
        const labels = await fetcher(`${WD}action=wbgetentities&props=labels&languages=en&ids=${d.industryIds.join("|")}`);
        const names = d.industryIds.map((i) => obj(obj(obj(obj(obj(labels.body).entities)[i]).labels).en).value).filter((v): v is string => typeof v === "string");
        if (names.length) industry = names.map((n) => n[0].toUpperCase() + n.slice(1)).join(" · ");
      }
    }
  }

  if (website) {
    const robots = await fetcher(`${website}robots.txt`);
    const allowed = robots.status !== 200 || typeof robots.body !== "string" || robotsAllows(robots.body, "/");
    if (allowed) {
      const home = await fetcher(website);
      const text = typeof home.body === "string" ? metaDescription(home.body) : null;
      if (text) return { website, blurb: shorten(text), blurbSource: "WEBSITE", industry };
    }
  }
  if (wikiTitle) {
    const sum = await fetcher(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`);
    const extract = obj(sum.body).extract;
    if (typeof extract === "string" && extract.trim()) return { website, blurb: shorten(extract), blurbSource: "WIKIPEDIA", industry };
  }
  return { website, blurb: null, blurbSource: null, industry };
}
