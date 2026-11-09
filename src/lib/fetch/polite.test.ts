import { test } from "node:test";
import assert from "node:assert/strict";
import { createPoliteFetcher, RequestCapReached } from "./polite.ts";

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });

test("one request at a time per host", async () => {
  let inFlight = 0, maxInFlight = 0;
  const fetchImpl = (async () => { inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); await new Promise((r) => setTimeout(r, 5)); inFlight--; return ok(); }) as typeof fetch;
  const { fetcher } = createPoliteFetcher({ fetchImpl, perHostDelayMs: 0, sleep: async () => {} });
  await Promise.all([1, 2, 3].map((i) => fetcher(`https://boards-api.greenhouse.io/v1/boards/c${i}/jobs`)));
  assert.equal(maxInFlight, 1);
});

test("stops at the request ceiling", async () => {
  const { fetcher } = createPoliteFetcher({ fetchImpl: (async () => ok()) as typeof fetch, perHostDelayMs: 0, sleep: async () => {}, maxRequestsPerRefresh: 2 });
  await fetcher("https://a.test/1"); await fetcher("https://b.test/1");
  await assert.rejects(fetcher("https://c.test/1"), RequestCapReached);
});

test("a second 429 pauses the host for the rest of the run", async () => {
  let calls = 0;
  const fetchImpl = (async () => { calls++; return new Response("", { status: 429 }); }) as typeof fetch;
  const { fetcher } = createPoliteFetcher({ fetchImpl, perHostDelayMs: 0, sleep: async () => {} });
  assert.equal((await fetcher("https://x.test/1")).status, 429);
  assert.equal((await fetcher("https://x.test/2")).status, 429);
  assert.equal(calls, 2); // the second URL never hit the network
});

test("sends an honest User-Agent", async () => {
  let ua = "";
  const fetchImpl = (async (_u: string, init?: RequestInit) => { ua = new Headers(init?.headers).get("user-agent") ?? ""; return ok(); }) as typeof fetch;
  const { fetcher } = createPoliteFetcher({ fetchImpl, perHostDelayMs: 0, sleep: async () => {} });
  await fetcher("https://y.test/1");
  assert.match(ua, /^[A-Za-z]+\/0\.1 \(personal job tracker; /);
});
