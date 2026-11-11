import { test } from "node:test";
import assert from "node:assert/strict";
import { careersLinkIn, discoverCareersPage } from "./discover.ts";
import type { Fetcher } from "../../lib/fetch/polite.ts";

test("careers link: the link that says Careers wins over one that only looks like it", () => {
  const html = `<a href="/blog/jobs-report">Jobs report</a><a href="/about">About</a><a href="https://careers.northwind.example/">Careers</a>`;
  assert.equal(careersLinkIn(html, "https://northwind.example/"), "https://careers.northwind.example/");
  assert.equal(careersLinkIn(`<a href="/company/careers">Work here</a>`, "https://northwind.example/"), "https://northwind.example/company/careers");
  assert.equal(careersLinkIn(`<a href="mailto:jobs@x.test">Careers</a>`, "https://northwind.example/"), null);
});

const site = (pages: Record<string, string>, robots = ""): Fetcher => async (url) => {
  if (url.endsWith("/robots.txt")) return { status: robots ? 200 : 404, body: robots || null, etag: null, host: "x" };
  const body = pages[url];
  return { status: body === undefined ? 404 : 200, body: body ?? null, etag: null, host: "x", finalUrl: url };
};

test("discovery: homepage → careers page → the Workday site it links to", async () => {
  const f = site({
    "https://northwind.example/": `<a href="/careers">Careers</a>`,
    "https://northwind.example/careers": `<a href="https://northwind.wd5.myworkdayjobs.com/External">Search open roles</a>`,
  });
  assert.deepEqual(await discoverCareersPage("https://northwind.example/", f), { url: "https://northwind.wd5.myworkdayjobs.com/External" });
});

test("discovery: keeps the careers page itself when nothing sits behind it; respects robots.txt", async () => {
  const pages = { "https://northwind.example/": `<a href="/careers">Careers</a>`, "https://northwind.example/careers": `<h2>Head of Product</h2>` };
  assert.deepEqual(await discoverCareersPage("https://northwind.example/", site(pages)), { url: "https://northwind.example/careers" });
  assert.equal(await discoverCareersPage("https://northwind.example/", site(pages, "User-agent: *\nDisallow: /")), null);
});
