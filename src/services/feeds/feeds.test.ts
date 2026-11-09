import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFeed, isStale, matchesPath, isAiStory, parseFeedDate } from "./parse.ts";
import { virgoFromAstrostyle, firstSentences } from "./horoscope.ts";
import { robotsAllows } from "./robots.ts";
import { tagHeadline } from "../pulse/rules.ts";

const xml = (n: string) => readFileSync(new URL(`../../../test/fixtures/feeds/${n}`, import.meta.url), "utf8");

test("reads titles that contain HTML, strips summaries, finds images", () => {
  const items = parseFeed(xml("rss-sample.xml"));
  assert.equal(items.length, 3);
  assert.equal(items[0].title, "Fernwood Clinics raises $12M seed to build AI front-desk tools");
  assert.equal(items[0].summary, "The company plans to expand into multi-site practices & more.");
  assert.equal(items[0].imageUrl, "https://news.example.test/img/fernwood.jpg");
});

test("parses nonstandard dates like 'Nov 7, 2026 4:20pm'", () => {
  assert.equal(parseFeedDate("Nov 7, 2026 4:20pm")?.getFullYear(), 2026);
  assert.equal(parseFeedDate("garbage"), null);
});

test("freshness is judged by the newest item, not the first", () => {
  const items = parseFeed(xml("rss-sample.xml"));
  assert.equal(isStale(items, 30, new Date("2026-11-08T12:00:00Z")), false);
  assert.equal(isStale(items, 30, new Date("2027-01-15T12:00:00Z")), true);
});

test("path filters keep only matching sections", () => {
  assert.equal(matchesPath("https://x.test/health-tech/a", "/health-tech/,/digital-health/"), true);
  assert.equal(matchesPath("https://x.test/finance/a", "/health-tech/,/digital-health/"), false);
  assert.equal(matchesPath("https://x.test/any", null), true);
});

test("AI stories by headline or category", () => {
  const items = parseFeed(xml("rss-sample.xml"));
  assert.equal(isAiStory(items[0]), true);
  assert.equal(isAiStory(items[1]), true); // category
  assert.equal(isAiStory(items[2]), false);
});

test("Market Pulse tags from headline wording", () => {
  assert.deepEqual(tagHeadline("Fernwood Clinics raises $12M seed to build AI front-desk tools"), { type: "FUNDING", companyName: "Fernwood Clinics", amount: "$12M", round: "Seed" });
  assert.equal(tagHeadline("STAT+: Northfield Bio names former payer executive as Chief Product Officer").type, "LEADERSHIP_HIRE");
  assert.equal(tagHeadline("STAT+: Northfield Bio names former payer executive as Chief Product Officer").companyName, "Northfield Bio");
  assert.equal(tagHeadline("Harbor Labs launches AI scheduling assistant for clinics").type, "LAUNCH");
  assert.equal(tagHeadline("Why hospitals are rethinking AI scribes").type, null);
  assert.equal(tagHeadline("Team raises questions about remote monitoring").type, null); // no amount or round
  assert.equal(tagHeadline("Weekly Rundown: Acme adds partners; Beta launches app").type, null); // roundups are skipped
});

test("Virgo reading comes from the newest dated daily post", () => {
  const items = parseFeed(xml("astrostyle-sample.xml"));
  const r = virgoFromAstrostyle(items, new Date("2026-11-08T12:00:00Z"));
  assert.ok(r);
  assert.match(r!.text, /^Invented sample reading for testing, Virgo\./);
  assert.ok(!r!.text.includes("Libra"));
  assert.equal(firstSentences(r!.text, 2), "Invented sample reading for testing, Virgo. A plan you set aside comes back into focus.");
});

test("no dated post in the last 50 hours means no horoscope", () => {
  assert.equal(virgoFromAstrostyle(parseFeed(xml("astrostyle-sample.xml")), new Date("2026-11-12T12:00:00Z")), null);
});

test("robots.txt: the longest matching rule wins for *", () => {
  const txt = "User-agent: ExampleBot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n";
  assert.equal(robotsAllows(txt, "/feed/"), true);
  assert.equal(robotsAllows(txt, "/wp-admin/x"), false);
  assert.equal(robotsAllows(txt, "/wp-admin/admin-ajax.php"), true);
});

test("decodes double-escaped entities", async () => {
  const { stripHtml } = await import("./parse.ts");
  assert.equal(stripHtml("Hims &amp;amp; Hers"), "Hims & Hers");
});
