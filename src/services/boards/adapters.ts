// Greenhouse, Lever, and Ashby public job-board APIs → one posting shape. Rules verified against each provider's docs.
import type { Fetcher } from "../../lib/fetch/polite.ts";

export type Provider = "GREENHOUSE" | "LEVER" | "ASHBY";
export type BoardPosting = {
  externalId: string;
  title: string;
  location: string | null;
  isRemote: boolean;
  url: string | null;
  postedAt: Date | null;
  compensation: string | null;
  employmentType: string | null;
};
export type BoardResult =
  | { kind: "ok"; postings: BoardPosting[]; complete: boolean; etag: string | null }
  | { kind: "not-modified" }
  | { kind: "missing" } // 404: wrong or stale board code
  | { kind: "failed"; status: number };

type J = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const date = (v: unknown): Date | null => { const s = str(v); const d = s ? new Date(s) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };

export async function fetchBoard(provider: Provider, code: string, fetcher: Fetcher, etag?: string | null): Promise<BoardResult> {
  if (provider === "LEVER") return fetchLever(code, fetcher);
  const url = provider === "GREENHOUSE"
    ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(code)}/jobs` // no content=true: small daily payload
    : `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(code)}?includeCompensation=true`;
  const res = await fetcher(url, { etag });
  if (res.status === 304) return { kind: "not-modified" };
  if (res.status === 404) return { kind: "missing" };
  if (res.status !== 200 || !res.body) return { kind: "failed", status: res.status };
  return provider === "GREENHOUSE" ? { ...parseGreenhouse(res.body as J), etag: res.etag } : { ...parseAshby(res.body as J), etag: res.etag };
}

export function parseGreenhouse(body: J): { kind: "ok"; postings: BoardPosting[]; complete: boolean } {
  const jobs = Array.isArray(body.jobs) ? (body.jobs as J[]) : [];
  const total = (body.meta as J | undefined)?.total;
  return {
    kind: "ok",
    complete: typeof total === "number" ? total === jobs.length : true,
    postings: jobs.map((j) => {
      const location = str((j.location as J | undefined)?.name);
      return {
        externalId: String(j.id),
        title: str(j.title) ?? "",
        location,
        isRemote: /remote/i.test(location ?? ""),
        url: str(j.absolute_url),
        postedAt: null, // the list has only updated_at; first_published comes from the single-job call
        compensation: null,
        employmentType: null,
      };
    }),
  };
}

export function parseAshby(body: J): { kind: "ok"; postings: BoardPosting[]; complete: boolean } {
  const jobs = Array.isArray(body.jobs) ? (body.jobs as J[]) : [];
  return {
    kind: "ok",
    complete: true, // returns all published postings
    postings: jobs.filter((j) => j.isListed !== false).map((j) => ({
      externalId: String(j.id),
      title: str(j.title) ?? "",
      location: str(j.location),
      isRemote: j.isRemote === true || j.workplaceType === "Remote",
      url: str(j.jobUrl),
      postedAt: date(j.publishedAt),
      compensation: str((j.compensation as J | undefined)?.compensationTierSummary),
      employmentType: str(j.employmentType),
    })),
  };
}

export function parseLeverPage(body: unknown): BoardPosting[] {
  const jobs = Array.isArray(body) ? (body as J[]) : [];
  return jobs.map((j) => {
    const cat = (j.categories as J | undefined) ?? {};
    const location = str(cat.location);
    return {
      externalId: String(j.id),
      title: str(j.text) ?? "",
      location,
      isRemote: j.workplaceType === "remote" || /remote/i.test(location ?? ""),
      url: str(j.hostedUrl),
      postedAt: null, // Lever has no posted date; ordering uses first-seen
      compensation: str(j.salaryDescriptionPlain),
      employmentType: str(cat.commitment),
    };
  });
}

// Lever's default page size isn't documented, so always page until a short page comes back.
export async function fetchLever(site: string, fetcher: Fetcher, limit = 100): Promise<BoardResult> {
  const all: BoardPosting[] = [];
  for (let skip = 0; skip < 5000; skip += limit) {
    const res = await fetcher(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json&skip=${skip}&limit=${limit}`);
    if (res.status === 404) return skip === 0 ? { kind: "missing" } : { kind: "ok", postings: all, complete: false, etag: null };
    if (res.status !== 200) return skip === 0 ? { kind: "failed", status: res.status } : { kind: "ok", postings: all, complete: false, etag: null };
    const page = parseLeverPage(res.body);
    all.push(...page);
    if (page.length < limit) return { kind: "ok", postings: all, complete: true, etag: null };
  }
  return { kind: "ok", postings: all, complete: false, etag: null };
}
