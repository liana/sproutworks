// Find a company's job board by trying code guesses on each provider. Pure: the fetcher is passed in.
import { fetchBoard, type Provider, type BoardPosting } from "./adapters.ts";
import type { Fetcher } from "../../lib/fetch/polite.ts";

export type ProbeMatch = { provider: Provider; code: string; postings: BoardPosting[] };

// A board with open jobs wins at once. A board that exists but has nothing posted today is
// still a real board, so it's kept as the fallback when no guess turns up open jobs.
export async function probeBoards(candidates: string[], providers: Provider[], fetcher: Fetcher): Promise<ProbeMatch | null> {
  let empty: ProbeMatch | null = null;
  for (const code of candidates) {
    for (const provider of providers) {
      const r = await fetchBoard(provider, code, fetcher);
      if (r.kind !== "ok") continue;
      if (r.postings.length > 0) return { provider, code, postings: r.postings };
      empty ??= { provider, code, postings: [] };
    }
  }
  return empty;
}

const BOARD_PAGES: Record<Provider, (code: string) => string> = {
  GREENHOUSE: (c) => `https://boards.greenhouse.io/${encodeURIComponent(c)}`,
  LEVER: (c) => `https://jobs.lever.co/${encodeURIComponent(c)}`,
  ASHBY: (c) => `https://jobs.ashbyhq.com/${encodeURIComponent(c)}`,
};

// The provider's public, human-readable board, so the user can check a match before confirming it.
export const publicBoardUrl = (provider: Provider, code: string) => BOARD_PAGES[provider](code);
