import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyJob, tierFor, cardState, closuresAllowed, countsTowardStale, relativeLabel } from "./rules.ts";

test("senior PM roles in Boston or US-remote qualify", () => {
  assert.equal(classifyJob({ title: "Director of Product, Remote Monitoring", location: "Boston, MA" }).qualifies, true);
  assert.equal(classifyJob({ title: "Senior Product Manager", location: "Remote - US" }).qualifies, true);
  assert.equal(classifyJob({ title: "Senior PM, Care Platform", location: "Remote (US)" }).qualifies, true);
});

test("rejects junior, wrong-function, and out-of-area roles with a reason", () => {
  assert.deepEqual(classifyJob({ title: "Product Manager", location: "Boston, MA" }), { qualifies: false, reason: "not-senior" });
  assert.deepEqual(classifyJob({ title: "Senior Product Marketing Manager", location: "Boston, MA" }), { qualifies: false, reason: "excluded-title" });
  assert.deepEqual(classifyJob({ title: "Senior Program Manager", location: "Boston, MA" }), { qualifies: false, reason: "excluded-title" });
  assert.deepEqual(classifyJob({ title: "Senior Product Manager", location: "San Francisco, CA" }), { qualifies: false, reason: "location" });
  assert.deepEqual(classifyJob({ title: "Senior Product Manager", location: "Remote - EMEA" }), { qualifies: false, reason: "location" });
});

test("tags fractional by title or employment type", () => {
  const r = classifyJob({ title: "Fractional Head of Product", location: "Remote" });
  assert.equal(r.qualifies && r.roleType, "FRACTIONAL");
  const c = classifyJob({ title: "Senior Product Manager", location: "Remote", employmentType: "Contract" });
  assert.equal(c.qualifies && c.roleType, "FRACTIONAL");
});

test("warm-intro tiers", () => {
  assert.equal(tierFor("VP, Product"), 1);
  assert.equal(tierFor("Engineering Manager"), 2);
  assert.equal(tierFor("Account Executive"), 3);
  assert.equal(tierFor(null), 3);
});

test("reviewed card stays hidden until an unseen job appears", () => {
  const none = new Set<string>();
  assert.equal(cardState(["a", "b"], ["a", "b"], none).visible, false);
  const back = cardState(["a", "b", "c"], ["a", "b"], none);
  assert.equal(back.visible, true);
  assert.deepEqual(back.newSinceReview, ["c"]);
});

test("a closed-then-reopened posting with the same ID doesn't resurface a reviewed card", () => {
  assert.equal(cardState(["a"], ["a", "b"], new Set()).visible, false);
});

test("applied jobs leave the card, and the card leaves when nothing is left", () => {
  const s = cardState(["a", "b"], null, new Set(["a"]));
  assert.deepEqual(s.jobs, ["b"]);
  assert.equal(cardState(["a"], null, new Set(["a"])).visible, false);
});

test("closures only after a complete, plausible fetch", () => {
  assert.equal(closuresAllowed(false, 10, 10, 0.5), false);
  assert.equal(closuresAllowed(true, 4, 10, 0.5), false);
  assert.equal(closuresAllowed(true, 6, 10, 0.5), true);
  assert.equal(closuresAllowed(true, 0, null, 0.5), true);
});

test("relative labels", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(relativeLabel(new Date("2026-11-04T12:00:00Z"), now), "4 days ago");
  assert.equal(relativeLabel(new Date("2020-03-02T00:00:00Z"), now), "6 years ago");
});

test("stale count: a missing board always counts; an empty one only if it once had jobs", () => {
  assert.equal(countsTowardStale(true, null), true);
  assert.equal(countsTowardStale(false, null), false); // confirmed while empty: nothing open yet
  assert.equal(countsTowardStale(false, 0), false);
  assert.equal(countsTowardStale(false, 12), true); // had jobs, now empty: maybe a dead board
});

test("careers pages: a senior PM title with no location qualifies only when allowed", () => {
  assert.equal(classifyJob({ title: "Director of Product", location: null }).qualifies, false);
  assert.equal(classifyJob({ title: "Director of Product", location: null, unknownLocationOk: true }).qualifies, true);
  assert.equal(classifyJob({ title: "Director of Product", location: "3 Locations", unknownLocationOk: true }).qualifies, true);
  assert.equal(classifyJob({ title: "Director of Product", location: "San Francisco, CA", unknownLocationOk: true }).qualifies, false); // a known, wrong place still fails
});
