// Which jobs are leads, which connections are warm intros, and when a reviewed card comes back. Pure.
import { PM_TITLE, EXCLUDED_TITLE, SENIOR_TITLE, FRACTIONAL, BOSTON_AREA, REMOTE, NON_US_REMOTE } from "../../config/filters.ts";
import { TIER_1, TIER_2 } from "../../config/tiers.ts";

export type JobInput = { title: string; location: string | null; isRemote?: boolean; employmentType?: string | null };
export type Classification =
  | { qualifies: true; roleType: "FULL_TIME" | "FRACTIONAL"; seniority: string }
  | { qualifies: false; reason: "not-pm" | "excluded-title" | "not-senior" | "location" };

export function classifyJob(job: JobInput): Classification {
  const t = job.title;
  if (EXCLUDED_TITLE.test(t)) return { qualifies: false, reason: "excluded-title" };
  if (!PM_TITLE.test(t)) return { qualifies: false, reason: "not-pm" };
  if (!SENIOR_TITLE.test(t)) return { qualifies: false, reason: "not-senior" };
  const loc = job.location ?? "";
  const remote = job.isRemote || REMOTE.test(loc);
  const ok = BOSTON_AREA.test(loc) || (remote && !NON_US_REMOTE.test(loc));
  if (!ok) return { qualifies: false, reason: "location" };
  const fractional = FRACTIONAL.test(t) || /contract|part ?time|temporary/i.test(job.employmentType ?? "");
  return { qualifies: true, roleType: fractional ? "FRACTIONAL" : "FULL_TIME", seniority: (t.match(SENIOR_TITLE)?.[0] ?? "senior").toLowerCase() };
}

export function tierFor(title: string | null): 1 | 2 | 3 {
  if (!title) return 3;
  if (TIER_1.test(title)) return 1;
  if (TIER_2.test(title)) return 2;
  return 3;
}

// A company card shows when it has a qualifying open job the user hasn't seen at review time and hasn't applied to.
export function cardState(openIds: string[], reviewedIds: string[] | null, appliedIds: Set<string>) {
  const unapplied = openIds.filter((id) => !appliedIds.has(id));
  const seen = new Set(reviewedIds ?? []);
  const unseen = unapplied.filter((id) => !seen.has(id));
  return {
    visible: unseen.length > 0,
    newSinceReview: reviewedIds ? unseen : [], // only highlight after a prior review
    jobs: unapplied,
  };
}

// Closure safety: only mark postings closed after a complete fetch that isn't suspiciously small.
export function closuresAllowed(complete: boolean, count: number, previousCount: number | null, minFraction: number): boolean {
  if (!complete) return false;
  if (previousCount && previousCount > 0 && count < previousCount * minFraction) return false;
  return true;
}

// A board that 404s is always suspect. An empty board is suspect only if it used to have jobs:
// a board confirmed while empty is just a company with nothing open yet.
export function countsTowardStale(missing: boolean, previousCount: number | null): boolean {
  return missing || (previousCount ?? 0) > 0;
}

export function relativeLabel(from: Date, now = new Date()): string {
  const days = Math.floor((now.getTime() - from.getTime()) / 864e5);
  if (days < 1) return "today";
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
