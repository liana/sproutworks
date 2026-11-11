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

test("a json option sends a POST with a JSON body", async () => {
  let seen: RequestInit | undefined;
  const fetchImpl = (async (_: string, init?: RequestInit) => { seen = init; return ok(); }) as typeof fetch;
  const { fetcher } = createPoliteFetcher({ fetchImpl, perHostDelayMs: 0, sleep: async () => {} });
  await fetcher("https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs", { json: { searchText: "product" } });
  assert.equal(seen?.method, "POST");
  assert.equal(seen?.body, JSON.stringify({ searchText: "product" }));
  assert.equal((seen?.headers as Record<string, string>)["Content-Type"], "application/json");
});

test("never requests LinkedIn: not directly, and not through a redirect", async () => {
  const sent: string[] = [];
  const fetchImpl = (async (url: string) => {
    sent.push(url);
    if (url === "https://acme.example/careers") return new Response("", { status: 301, headers: { location: "https://www.linkedin.com/company/acme/jobs" } });
    if (url === "https://acme.example/old") return new Response("", { status: 302, headers: { location: "/careers-new" } });
    return new Response("<h1>ok</h1>", { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
  const { fetcher } = createPoliteFetcher({ fetchImpl, perHostDelayMs: 0, sleep: async () => {} });
  for (const u of ["https://www.linkedin.com/company/acme/jobs", "https://lnkd.in/abc", "https://media.licdn.com/x.png"]) assert.equal((await fetcher(u)).status, 451);
  assert.deepEqual(sent, []);
  assert.equal((await fetcher("https://acme.example/careers")).status, 451);
  assert.deepEqual(sent, ["https://acme.example/careers"]); // the redirect target was never requested
  const r = await fetcher("https://acme.example/old"); // ordinary redirects still work
  assert.equal(r.status, 200);
  assert.equal(r.finalUrl, "https://acme.example/careers-new");
});
