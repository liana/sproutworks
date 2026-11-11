// Find a company's job board by trying code guesses on each provider. Pure: the fetcher is passed in.
import { fetchBoard, type Provider, type BoardPosting } from "./adapters.ts";
import type { Fetcher } from "../../lib/fetch/polite.ts";
import { normalizeCompanyName } from "../companies/normalize.ts";

export type ProbeMatch = { provider: Provider; code: string; postings: BoardPosting[] };

// A board with open jobs wins at once. A board that exists but has nothing posted today is
// still a real board, so it's kept as the fallback when no guess turns up open jobs.
// Matches are used without asking the user. A code shorter than the full name ("atlas" for Atlas Health)
// could be another company's board, so it counts only if the board itself shows the full name.
export async function probeBoards(candidates: string[], providers: Provider[], fetcher: Fetcher, fullName?: string): Promise<ProbeMatch | null> {
  const full = fullName ? compact(fullName) : null;
  let empty: ProbeMatch | null = null;
  for (const code of candidates) {
    const shortGuess = !!full && compact(code) !== full;
    for (const provider of providers) {
      const r = await fetchBoard(provider, code, fetcher);
      if (r.kind !== "ok") continue;
      if (shortGuess && !(await boardShowsName(full!, provider, code, r.postings, fetcher))) continue;
      if (r.postings.length > 0) return { provider, code, postings: r.postings };
      empty ??= { provider, code, postings: [] };
    }
  }
  return empty;
}

// The same normalization that makes the guesses, so the full-name guess itself is never "short".
const compact = (s: string) => normalizeCompanyName(s).replace(/[^\p{L}\p{N}]/gu, "");

// The full name in a job link (atlashealth.com/careers?gh_jid=1) or the board page's title ("Jobs at Atlas Health").
export async function boardShowsName(full: string, provider: Provider, code: string, postings: BoardPosting[], fetcher: Fetcher): Promise<boolean> {
  const host = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
  if (postings.some((p) => p.url && compact(host(p.url)).includes(full))) return true;
  const page = await fetcher(publicBoardUrl(provider, code));
  const title = typeof page.body === "string" ? page.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "" : "";
  return compact(title).includes(full);
}

// Job-board addresses the three providers publish, in a URL or anywhere in a careers page's HTML
// (links, iframes, embed scripts). Each captures the board code.
const BOARD_PATTERNS: [Provider, RegExp][] = [
  ["GREENHOUSE", /(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io\/embed\/job_board(?:\/js)?\?(?:[^"'\s<>]*&(?:amp;)?)?for=([a-z0-9_-]+)/i],
  ["GREENHOUSE", /(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io\/(?!embed\b)([a-z0-9_-]+)/i],
  ["GREENHOUSE", /boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)/i],
  ["LEVER", /jobs(?:\.eu)?\.lever\.co\/([a-z0-9_.-]+)/i],
  ["LEVER", /api(?:\.eu)?\.lever\.co\/v0\/postings\/([a-z0-9_.-]+)/i],
  ["ASHBY", /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i],
  ["ASHBY", /api\.ashbyhq\.com\/posting-api\/job-board\/([a-z0-9_.%-]+)/i],
];

export function boardInText(text: string): { provider: Provider; code: string } | null {
  for (const [provider, re] of BOARD_PATTERNS) {
    const code = text.match(re)?.[1];
    if (code) return { provider, code: decodeURIComponent(code) };
  }
  return null;
}

const BOARD_PAGES: Record<Provider, (code: string) => string> = {
  GREENHOUSE: (c) => `https://boards.greenhouse.io/${encodeURIComponent(c)}`,
  LEVER: (c) => `https://jobs.lever.co/${encodeURIComponent(c)}`,
  ASHBY: (c) => `https://jobs.ashbyhq.com/${encodeURIComponent(c)}`,
};

// The provider's public, human-readable board, so the user can check a match before confirming it.
export const publicBoardUrl = (provider: Provider, code: string) => BOARD_PAGES[provider](code);
