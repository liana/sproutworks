import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWorkdayUrl, workdayInText, workdayPostedDate, fetchWorkday } from "./workday.ts";
import type { Fetcher } from "../../lib/fetch/polite.ts";

test("workday address: tenant and site, with or without a locale", () => {
  assert.deepEqual(parseWorkdayUrl("https://acme.wd5.myworkdayjobs.com/en-US/External/job/Boston/PM_R1"), { origin: "https://acme.wd5.myworkdayjobs.com", tenant: "acme", site: "External" });
  assert.deepEqual(parseWorkdayUrl("https://acme.wd1.myworkdayjobs.com/AcmeCareers"), { origin: "https://acme.wd1.myworkdayjobs.com", tenant: "acme", site: "AcmeCareers" });
  assert.equal(parseWorkdayUrl("https://acme.wd1.myworkdayjobs.com/"), null);
  assert.equal(parseWorkdayUrl("https://careers.acme.com/jobs"), null);
  assert.equal(workdayInText(`<a class="btn" href="https://acme.wd5.myworkdayjobs.com/External">Search jobs</a>`), "https://acme.wd5.myworkdayjobs.com/External");
});

test("workday posted dates", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  assert.equal(workdayPostedDate("Posted Today", now)?.toISOString().slice(0, 10), "2026-11-10");
  assert.equal(workdayPostedDate("Posted Yesterday", now)?.toISOString().slice(0, 10), "2026-11-09");
  assert.equal(workdayPostedDate("Posted 30+ Days Ago", now)?.toISOString().slice(0, 10), "2026-10-11");
  assert.equal(workdayPostedDate(undefined, now), null);
});

test("workday fetch: searches for product manager roles, pages by the first page's total, builds job links", async () => {
  const asked: unknown[] = [];
  const job = (i: number) => ({ title: `Senior Product Manager ${i}`, externalPath: `/job/Boston-MA/SPM_R${i}`, locationsText: "Boston, MA", postedOn: "Posted Today" });
  const f: Fetcher = async (_url, opts) => {
    asked.push(opts?.json);
    const offset = (opts?.json as { offset: number }).offset;
    return { status: 200, body: offset === 0 ? { total: 25, jobPostings: Array.from({ length: 20 }, (_, i) => job(i)) } : { total: 0, jobPostings: Array.from({ length: 5 }, (_, i) => job(20 + i)) }, etag: null, host: "x" };
  };
  const r = await fetchWorkday({ origin: "https://acme.wd5.myworkdayjobs.com", tenant: "acme", site: "External" }, f);
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") return;
  assert.equal(r.postings.length, 25);
  assert.equal(r.complete, true);
  assert.equal((asked[0] as { searchText: string }).searchText, "product manager");
  assert.equal(r.postings[0].url, "https://acme.wd5.myworkdayjobs.com/External/job/Boston-MA/SPM_R0");
});

test("workday fetch: a refused first request is a failure, not an empty board", async () => {
  const f: Fetcher = async () => ({ status: 403, body: null, etag: null, host: "x" });
  assert.deepEqual(await fetchWorkday({ origin: "https://a.wd1.myworkdayjobs.com", tenant: "a", site: "S" }, f), { kind: "failed", status: 403 });
});
