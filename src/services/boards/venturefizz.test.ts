import { test } from "node:test";
import assert from "node:assert/strict";
import { companySlugFrom, matchCompany, ventureFizzPostings } from "./venturefizz.ts";

test("company comes from the URL slug minus the title slug", () => {
  assert.equal(companySlugFrom("https://venturefizz.com/job/zus-health-future-zusers/", "Future Zusers"), "zus-health");
  assert.equal(companySlugFrom("https://venturefizz.com/job/acme-senior-product-manager-vault-qms-2/", "Senior Product Manager – Vault QMS"), "acme");
  assert.equal(companySlugFrom("https://venturefizz.com/", "Home"), null);
});

test("matches only companies the user knows people at", () => {
  const known = [{ id: "c1", name: "Zus Health, Inc." }, { id: "c2", name: "Acme" }];
  assert.equal(matchCompany("zus-health", known), "c1");
  assert.equal(matchCompany("other-co", known), null);
  const items = [
    { url: "https://venturefizz.com/job/acme-senior-product-manager/", title: "Senior Product Manager", summary: null, imageUrl: null, publishedAt: new Date("2026-11-08"), categories: [], contentHtml: "" },
    { url: "https://venturefizz.com/job/stranger-senior-product-manager/", title: "Senior Product Manager", summary: null, imageUrl: null, publishedAt: null, categories: [], contentHtml: "" },
  ];
  assert.deepEqual(ventureFizzPostings(items, known).map((p) => p.companyId), ["c2"]);
});
