// Read a company's own careers page, in order of how much to trust it:
// a job board behind it, a Workday site behind it, structured listings, then job titles in the page text. Pure.
import type { Provider, BoardPosting } from "./adapters.ts";
import { boardInText } from "./probe.ts";
import { workdayInText } from "./workday.ts";
import { classifyJob } from "../leads/rules.ts";

export type PageRead =
  | { kind: "BOARD"; provider: Provider; code: string }
  | { kind: "WORKDAY"; url: string }
  | { kind: "LISTINGS" | "TEXT"; postings: BoardPosting[] } // every posting found; the caller filters
  | { kind: "UNREADABLE" };

type J = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const absolute = (href: string, base: string) => { try { return new URL(decode(href), base).toString(); } catch { return null; } };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// schema.org JobPosting objects, wherever they sit in a page's JSON-LD (@graph, arrays, ItemList).
export function jobPostingsFromJsonLd(html: string, pageUrl: string): BoardPosting[] {
  const found: J[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== "object") return;
    const o = v as J;
    const type = o["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) found.push(o);
    for (const k of ["@graph", "itemListElement", "item", "mainEntity"]) if (k in o) walk(o[k]);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* a malformed block is skipped, not fatal */ }
  }
  return found.map((j) => {
    const places = (Array.isArray(j.jobLocation) ? j.jobLocation : [j.jobLocation]) as J[];
    const location = places.map((p) => { const a = (p?.address ?? {}) as J; return [str(a.addressLocality), str(a.addressRegion)].filter(Boolean).join(", "); }).filter(Boolean).join(" · ") || null;
    const id = str((j.identifier as J | undefined)?.value) ?? str(j.identifier) ?? str(j.url) ?? str(j.title) ?? "";
    const posted = str(j.datePosted);
    const postedAt = posted && !Number.isNaN(new Date(posted).getTime()) ? new Date(posted) : null;
    return {
      externalId: `ld:${id}`,
      title: decode(str(j.title) ?? ""),
      location,
      isRemote: /telecommute/i.test(String(j.jobLocationType ?? "")),
      url: absolute(str(j.url) ?? pageUrl, pageUrl),
      postedAt,
      compensation: null,
      employmentType: Array.isArray(j.employmentType) ? j.employmentType.join(", ") : str(j.employmentType),
    };
  }).filter((p) => p.title);
}

// Words that show a line is a job title at all, of any kind. Used only to tell a readable page from an empty shell.
const ANY_JOB = /\b(manager|engineer|director|designer|analyst|lead|head|specialist|coordinator|associate|scientist|developer|architect|consultant|officer|representative|technician|intern|nurse|administrator)\b/i;

// Titles in links and headings, the way simple careers pages list openings.
export function titlesFromText(html: string, pageUrl: string): { postings: BoardPosting[]; jobLike: number } {
  const body = html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ").replace(/<(nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ");
  const seen = new Set<string>();
  const postings: BoardPosting[] = [];
  let jobLike = 0;
  for (const m of body.matchAll(/<(a|h[1-4]|li|dt|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const text = decode(m[3].replace(/<[^>]+>/g, " "));
    if (text.length < 6 || text.length > 120 || seen.has(text)) continue;
    seen.add(text);
    if (!ANY_JOB.test(text)) continue;
    jobLike++;
    // The link may be the element itself or sit inside it (<li><a href>Title</a></li>).
    const href = (m[1].toLowerCase() === "a" ? m[2] : m[3]).match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
    const url = href && !href.startsWith("#") && !/^(mailto|javascript):/i.test(href) ? absolute(href, pageUrl) : pageUrl;
    postings.push({ externalId: `text:${slug(text)}`, title: text, location: null, isRemote: /\bremote\b/i.test(text), url, postedAt: null, compensation: null, employmentType: null });
  }
  return { postings, jobLike };
}

export function readCareersPage(html: string, pageUrl: string): PageRead {
  const board = boardInText(html);
  if (board) return { kind: "BOARD", ...board };
  const workday = workdayInText(html);
  if (workday) return { kind: "WORKDAY", url: workday };
  const listings = jobPostingsFromJsonLd(html, pageUrl);
  if (listings.length) return { kind: "LISTINGS", postings: listings };
  const text = titlesFromText(html, pageUrl);
  // Readable if it lists jobs of any kind, or at least one senior product role (a one-opening startup page).
  return text.jobLike >= 3 || qualifyingFromPage(text.postings).length > 0 ? { kind: "TEXT", postings: text.postings } : { kind: "UNREADABLE" };
}

// The jobs worth showing from a careers page: senior product roles, with a missing location allowed.
export function qualifyingFromPage(postings: BoardPosting[]) {
  return postings.flatMap((p) => {
    const c = classifyJob({ ...p, unknownLocationOk: true });
    return c.qualifies ? [{ ...p, location: p.location ?? "Location not listed", roleType: c.roleType, seniority: c.seniority }] : [];
  });
}
