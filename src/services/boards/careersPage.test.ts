import { test } from "node:test";
import assert from "node:assert/strict";
import { readCareersPage, jobPostingsFromJsonLd, titlesFromText, qualifyingFromPage } from "./careersPage.ts";

const PAGE = "https://northwind.example/careers";

test("structured listings: JobPosting objects in @graph, with location, remote, and link", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@graph": [
    { "@type": "Organization", name: "Northwind" },
    { "@type": "JobPosting", title: "Director of Product", url: "/careers/dop", datePosted: "2026-11-02", identifier: { value: "R-9" }, jobLocation: { address: { addressLocality: "Boston", addressRegion: "MA" } } },
    { "@type": "JobPosting", title: "Senior Product Manager", jobLocationType: "TELECOMMUTE" },
  ] })}</script>`;
  const p = jobPostingsFromJsonLd(html, PAGE);
  assert.equal(p.length, 2);
  assert.deepEqual([p[0].location, p[0].url, p[0].externalId], ["Boston, MA", "https://northwind.example/careers/dop", "ld:R-9"]);
  assert.equal(p[1].isRemote, true);
});

test("page text: titles in links and headings, skipping nav and scripts", () => {
  const html = `<nav><a href="/product">Product Manager tools</a></nav>
    <h3>Open roles</h3>
    <ul><li><a href="/jobs/1">Head of Product, Care Platform</a></li><li><a href="/jobs/2">Senior Software Engineer</a></li><li>Account Manager</li></ul>
    <script>var t = "Director of Product";</script>`;
  const r = titlesFromText(html, PAGE);
  assert.deepEqual(r.postings.map((p) => p.title), ["Head of Product, Care Platform", "Senior Software Engineer", "Account Manager"]);
  assert.equal(r.postings[0].url, "https://northwind.example/jobs/1");
});

test("reading order: a job board, then Workday, then listings, then text; an empty shell is unreadable", () => {
  assert.deepEqual(readCareersPage(`<iframe src="https://boards.greenhouse.io/embed/job_board?for=northwind">`, PAGE), { kind: "BOARD", provider: "GREENHOUSE", code: "northwind" });
  assert.deepEqual(readCareersPage(`<a href="https://northwind.wd5.myworkdayjobs.com/External">See jobs</a>`, PAGE), { kind: "WORKDAY", url: "https://northwind.wd5.myworkdayjobs.com/External" });
  assert.equal(readCareersPage(`<script type="application/ld+json">{"@type":"JobPosting","title":"Head of Product"}</script>`, PAGE).kind, "LISTINGS");
  assert.equal(readCareersPage(`<h2>Head of Product</h2>`, PAGE).kind, "TEXT"); // one opening is enough
  assert.equal(readCareersPage(`<div id="root"></div><script src="/app.js"></script>`, PAGE).kind, "UNREADABLE");
});

test("only senior product roles count, and a missing location is labeled", () => {
  const q = qualifyingFromPage(titlesFromText(`<h2>Head of Product</h2><h2>Senior Software Engineer</h2><h2>Product Manager</h2>`, PAGE).postings);
  assert.deepEqual(q.map((p) => [p.title, p.location]), [["Head of Product", "Location not listed"]]);
});
