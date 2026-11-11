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

test("finds the board behind a careers link or page: links, embeds, and API addresses", async () => {
  const { boardInText } = await import("./probe.ts");
  assert.deepEqual(boardInText("https://boards.greenhouse.io/northfield/jobs/123"), { provider: "GREENHOUSE", code: "northfield" });
  assert.deepEqual(boardInText(`<script src="https://boards.greenhouse.io/embed/job_board/js?for=northfield"></script>`), { provider: "GREENHOUSE", code: "northfield" });
  assert.deepEqual(boardInText(`<iframe src="https://job-boards.greenhouse.io/embed/job_board?b=1&amp;for=acme">`), { provider: "GREENHOUSE", code: "acme" });
  assert.deepEqual(boardInText("https://job-boards.greenhouse.io/acme"), { provider: "GREENHOUSE", code: "acme" });
  assert.deepEqual(boardInText(`<a href="https://jobs.lever.co/quarryai/abc-123">`), { provider: "LEVER", code: "quarryai" });
  assert.deepEqual(boardInText(`fetch("https://api.ashbyhq.com/posting-api/job-board/lumenhealth")`), { provider: "ASHBY", code: "lumenhealth" });
  assert.equal(boardInText(`<a href="https://northwind.wd5.myworkdayjobs.com/External">`), null);
});

test("a shortened guess counts only if the board shows the company's full name", async () => {
  // Atlas Health: "atlas" is another company's board; Atlas Health's own sits at "atlashealth".
  const routes = (titles: Record<string, string>, boards: Record<string, unknown>): Fetcher => async (url) => {
    const page = Object.keys(titles).find((k) => url === k);
    if (page) return { status: 200, body: titles[page], etag: null, host: "x" };
    const key = Object.keys(boards).find((k) => url.includes(k));
    return key ? { status: 200, body: boards[key], etag: null, host: "x" } : { status: 404, body: null, etag: null, host: "x" };
  };
  const other = routes({ "https://boards.greenhouse.io/atlas": "<title>Jobs at Atlas Freight</title>" }, { "boards/atlas/jobs": gh(["Senior Product Manager"]) });
  assert.equal(await probeBoards(["atlashealth", "atlas"], ["GREENHOUSE"], other, "Atlas Health"), null);
  const theirs = routes({ "https://boards.greenhouse.io/atlas": "<title>Jobs at Atlas Health</title>" }, { "boards/atlas/jobs": gh(["Senior Product Manager"]) });
  assert.equal((await probeBoards(["atlashealth", "atlas"], ["GREENHOUSE"], theirs, "Atlas Health"))?.code, "atlas");
  // The full-name guess needs no extra check.
  let pages = 0;
  const full: Fetcher = async (url) => { if (url.startsWith("https://boards.greenhouse.io/")) pages++; return url.includes("boards/atlashealth/jobs") ? { status: 200, body: gh(["Head of Product"]), etag: null, host: "x" } : { status: 404, body: null, etag: null, host: "x" }; };
  assert.equal((await probeBoards(["atlashealth", "atlas"], ["GREENHOUSE"], full, "Atlas Health"))?.code, "atlashealth");
  assert.equal(pages, 0);
});
