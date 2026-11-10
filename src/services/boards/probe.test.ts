import { test } from "node:test";
import assert from "node:assert/strict";
import { probeBoards, publicBoardUrl } from "./probe.ts";
import type { Fetcher } from "../../lib/fetch/polite.ts";

// Routes match on URL substrings; anything unmatched is a 404 (no such board).
const fake = (routes: Record<string, unknown>): Fetcher => async (url) => {
  const key = Object.keys(routes).find((k) => url.includes(k));
  return key ? { status: 200, body: routes[key], etag: null, host: new URL(url).host } : { status: 404, body: null, etag: null, host: new URL(url).host };
};
const gh = (titles: string[]) => ({ jobs: titles.map((t, i) => ({ id: i, title: t, location: { name: "Remote" } })), meta: { total: titles.length } });

test("a board with no open jobs is still found (it used to be dropped as 'no board')", async () => {
  const m = await probeBoards(["quietco"], ["GREENHOUSE", "LEVER", "ASHBY"], fake({ "boards/quietco/jobs": gh([]) }));
  assert.deepEqual(m && { provider: m.provider, code: m.code, jobs: m.postings.length }, { provider: "GREENHOUSE", code: "quietco", jobs: 0 });
});

test("a later guess with open jobs beats an earlier empty board", async () => {
  const m = await probeBoards(["acme", "acme-health"], ["GREENHOUSE", "LEVER"], fake({
    "boards/acme/jobs": gh([]),
    "postings/acme-health": [{ id: "l1", text: "Head of Product", categories: { location: "Remote" } }],
  }));
  assert.equal(m?.provider, "LEVER");
  assert.equal(m?.code, "acme-health");
  assert.equal(m?.postings.length, 1);
});

test("no board anywhere returns null", async () => {
  assert.equal(await probeBoards(["nobody"], ["GREENHOUSE", "ASHBY"], fake({})), null);
});

test("public board links point at each provider's readable page", () => {
  assert.equal(publicBoardUrl("GREENHOUSE", "acme"), "https://boards.greenhouse.io/acme");
  assert.equal(publicBoardUrl("LEVER", "acme"), "https://jobs.lever.co/acme");
  assert.equal(publicBoardUrl("ASHBY", "acme"), "https://jobs.ashbyhq.com/acme");
});
