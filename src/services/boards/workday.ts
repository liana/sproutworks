// Workday career sites. Workday publishes no job feed; its career sites load jobs from a JSON endpoint,
// the same request a browser makes on the page. Read once a day, searching for product manager roles only.
// User decision Nov 10. If Workday changes the endpoint, the company shows as unreadable. Pure: fetcher passed in.
import type { Fetcher } from "../../lib/fetch/polite.ts";
import type { BoardPosting } from "./adapters.ts";

export type WorkdaySite = { origin: string; tenant: string; site: string };

// https://acme.wd5.myworkdayjobs.com/en-US/External/job/... → { tenant: "acme", site: "External" }
export function parseWorkdayUrl(url: string): WorkdaySite | null {
  try {
    const u = new URL(url);
    const host = u.hostname.match(/^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i);
    if (!host) return null;
    const parts = u.pathname.split("/").filter(Boolean).filter((p) => !/^[a-z]{2}-[A-Z]{2}$/.test(p)); // drop the locale
    const site = parts[0];
    if (!site || site === "wday") return null;
    return { origin: u.origin, tenant: host[1], site };
  } catch { return null; }
}

export function workdayInText(text: string): string | null {
  return text.match(/https?:\/\/[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com\/[^\s"'<>)]+/i)?.[0] ?? null;
}

// "Posted Today" · "Posted Yesterday" · "Posted 3 Days Ago" · "Posted 30+ Days Ago"
export function workdayPostedDate(text: unknown, now = new Date()): Date | null {
  if (typeof text !== "string") return null;
  const day = 864e5;
  if (/today/i.test(text)) return new Date(now.getTime());
  if (/yesterday/i.test(text)) return new Date(now.getTime() - day);
  const n = text.match(/(\d+)\+?\s+days?\s+ago/i)?.[1];
  return n ? new Date(now.getTime() - Number(n) * day) : null;
}

type J = Record<string, unknown>;
const PAGE = 20;
// Relevance-ranked. Checked against a large live site Nov 10: "product" alone returns mostly engineering
// roles; "product manager" put 18 of the first 20 results on target.
const WORKDAY_SEARCH = "product manager";

export type WorkdayResult = { kind: "ok"; postings: BoardPosting[]; complete: boolean } | { kind: "failed"; status: number };

export async function fetchWorkday(site: WorkdaySite, fetcher: Fetcher, maxPages = 5, now = new Date()): Promise<WorkdayResult> {
  const endpoint = `${site.origin}/wday/cxs/${encodeURIComponent(site.tenant)}/${encodeURIComponent(site.site)}/jobs`;
  const postings: BoardPosting[] = [];
  let total: number | null = null; // Workday reports the total on the first page only
  for (let page = 0; page < maxPages; page++) {
    const res = await fetcher(endpoint, { json: { appliedFacets: {}, limit: PAGE, offset: page * PAGE, searchText: WORKDAY_SEARCH } });
    if (res.status !== 200 || !res.body || typeof res.body !== "object") return page === 0 ? { kind: "failed", status: res.status } : { kind: "ok", postings, complete: false };
    const body = res.body as J;
    const jobs = Array.isArray(body.jobPostings) ? (body.jobPostings as J[]) : [];
    for (const j of jobs) {
      const path = typeof j.externalPath === "string" ? j.externalPath : null;
      const location = typeof j.locationsText === "string" ? j.locationsText : null;
      postings.push({
        externalId: `${site.tenant}:${path ?? j.title}`,
        title: typeof j.title === "string" ? j.title.trim() : "",
        location,
        isRemote: /remote/i.test(location ?? "") || /remote/i.test(String(j.remoteType ?? "")),
        url: path ? `${site.origin}/${site.site}${path}` : `${site.origin}/${site.site}`,
        postedAt: workdayPostedDate(j.postedOn, now),
        compensation: null,
        employmentType: null,
      });
    }
    if (page === 0 && typeof body.total === "number") total = body.total;
    if (jobs.length < PAGE || (total !== null && postings.length >= total)) return { kind: "ok", postings, complete: true };
  }
  return { kind: "ok", postings, complete: false };
}
