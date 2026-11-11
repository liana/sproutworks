import { test } from "node:test";
import assert from "node:assert/strict";
import { homepageFrom, metaDescription, shorten, pickWikidataMatch, readWikidataEntity, gatherCompanyInfo } from "./info.ts";
import type { Fetcher } from "../../lib/fetch/polite.ts";

test("homepage comes from a careers link on the company's own domain, never a hiring tool's", () => {
  assert.equal(homepageFrom("https://careers.northwindhealth.com/jobs?x=1"), "https://northwindhealth.com/");
  assert.equal(homepageFrom("https://www.quarry.ai/careers"), "https://quarry.ai/");
  assert.equal(homepageFrom("https://northwind.wd5.myworkdayjobs.com/External"), null);
  assert.equal(homepageFrom("https://boards.greenhouse.io/northwind"), null);
  assert.equal(homepageFrom("not a url"), null);
});

test("meta description: reads name or og: tags in any attribute order, skips stubs, decodes entities", () => {
  assert.equal(metaDescription(`<meta name="description" content="Hi">`), null);
  assert.equal(metaDescription(`<meta content="Care navigation for employers &amp; health plans." property="og:description">`), "Care navigation for employers & health plans.");
  assert.equal(metaDescription(`<html><head><title>x</title></head></html>`), null);
});

test("shorten keeps at most two sentences", () => {
  assert.equal(shorten("One thing. Two things. Three things."), "One thing. Two things.");
  assert.ok(shorten("a ".repeat(300)).length <= 262);
});

test("wikidata: takes a hit only when the name matches and it's described as a business", () => {
  const search = { search: [
    { id: "Q1", label: "Northwind", description: "village in England" },
    { id: "Q2", label: "Northwind Inc.", description: "American health technology company" },
  ] };
  assert.equal(pickWikidataMatch("Northwind", search), "Q2");
  assert.equal(pickWikidataMatch("Southwind", search), null);
});

test("wikidata entity: website, industries, and the Wikipedia title", () => {
  const body = { entities: { Q2: {
    claims: {
      P856: [{ mainsnak: { datavalue: { value: "https://northwind.example" } } }],
      P452: [{ mainsnak: { datavalue: { value: { id: "Q10" } } } }],
    },
    sitelinks: { enwiki: { title: "Northwind Inc." } },
    descriptions: { en: { value: "American health technology company" } },
  } } };
  assert.deepEqual(readWikidataEntity("Q2", body), { website: "https://northwind.example", industryIds: ["Q10"], wikiTitle: "Northwind Inc.", description: "American health technology company" });
});

test("gather: the company's own description first, Wikipedia when the site has none", async () => {
  const routes: [RegExp, unknown][] = [
    [/wbsearchentities/, { search: [{ id: "Q2", label: "Northwind", description: "software company" }] }],
    [/ids=Q2$/, { entities: { Q2: { claims: { P856: [{ mainsnak: { datavalue: { value: "https://northwind.example/" } } }], P452: [{ mainsnak: { datavalue: { value: { id: "Q10" } } } }] }, sitelinks: { enwiki: { title: "Northwind" } } } } }],
    [/ids=Q10$/, { entities: { Q10: { labels: { en: { value: "health care" } } } } }],
    [/robots\.txt/, "User-agent: *\nDisallow: /private"],
    [/northwind\.example\/$/, `<meta name="description" content="Care navigation for employers. Built for people.">`],
    [/wikipedia/, { extract: "Northwind is a company." }],
  ];
  const fake = (skipSite: boolean): Fetcher => async (url) => {
    const hit = routes.find(([re]) => re.test(url) && !(skipSite && /northwind\.example\/$/.test(url)));
    return { status: hit ? 200 : 404, body: hit?.[1] ?? null, etag: null, host: new URL(url).host };
  };
  assert.deepEqual(await gatherCompanyInfo("Northwind", null, fake(false)),
    { website: "https://northwind.example/", blurb: "Care navigation for employers. Built for people.", blurbSource: "WEBSITE", industry: "Health care" });
  assert.equal((await gatherCompanyInfo("Northwind", null, fake(true))).blurbSource, "WIKIPEDIA");
});
