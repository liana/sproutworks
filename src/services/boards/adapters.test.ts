import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchBoard, parseGreenhouse } from "./adapters.ts";
import type { Fetcher } from "../../lib/fetch/polite.ts";

const fixture = (n: string) => JSON.parse(readFileSync(new URL(`../../../test/fixtures/boards/${n}`, import.meta.url), "utf8"));
const fake = (routes: Record<string, unknown>): Fetcher => async (url) => {
  const key = Object.keys(routes).find((k) => url.includes(k));
  return key ? { status: 200, body: routes[key], etag: null, host: new URL(url).host } : { status: 404, body: null, etag: null, host: new URL(url).host };
};

test("greenhouse: never asks for content=true on the daily fetch, and checks meta.total", async () => {
  const seen: string[] = [];
  const f: Fetcher = async (url) => { seen.push(url); return { status: 200, body: fixture("greenhouse-northfield.json"), etag: null, host: "x" }; };
  const r = await fetchBoard("GREENHOUSE", "northfield", f);
  assert.equal(r.kind, "ok");
  assert.ok(!seen[0].includes("content=true"));
  assert.equal(r.kind === "ok" && r.complete, true);
  assert.equal(parseGreenhouse({ jobs: [], meta: { total: 3 } }).complete, false);
});

test("ashby: asks for compensation and maps remote, contract, posted date", async () => {
  let asked = "";
  const f: Fetcher = async (url) => { asked = url; return { status: 200, body: fixture("ashby-lumenhealth.json"), etag: null, host: "x" }; };
  const r = await fetchBoard("ASHBY", "lumenhealth", f);
  assert.ok(asked.includes("includeCompensation=true"));
  assert.ok(r.kind === "ok");
  if (r.kind !== "ok") return;
  assert.equal(r.postings[0].compensation, "$210K – $240K");
  assert.equal(r.postings[1].isRemote, true);
  assert.equal(r.postings[0].postedAt?.toISOString().slice(0, 10), "2026-11-06");
});

test("lever: pages until a short page and marks the fetch complete", async () => {
  const pageA = Array.from({ length: 2 }, (_, i) => ({ id: `l${i}`, text: `Senior Product Manager ${i}`, categories: { location: "Remote" }, hostedUrl: "https://example.test" }));
  const pageB = [{ id: "l9", text: "Fractional Head of Product", categories: { location: "Remote", commitment: "Contract" }, hostedUrl: "https://example.test" }];
  const f: Fetcher = async (url) => ({ status: 200, body: url.includes("skip=0") ? pageA : pageB, etag: null, host: "x" });
  const { fetchLever } = await import("./adapters.ts");
  const r = await fetchLever("quarry", f, 2);
  assert.equal(r.kind === "ok" && r.postings.length, 3);
  assert.equal(r.kind === "ok" && r.complete, true);
});

test("a 404 is reported as a missing board, not an empty one", async () => {
  assert.deepEqual(await fetchBoard("ASHBY", "nope", fake({})), { kind: "missing" });
});
