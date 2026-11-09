import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteAppears, employerKnown, unverifiedTerms } from "./verify.ts";
import { assemble, words } from "./letter.ts";
import { POSITIONING_STATEMENT } from "../../config/cover-letter/examples.ts";

const JD = "We're looking for a leader who can turn complex data systems into product infrastructure. Experience in digital health or regulated environments is a plus.";

test("quotes must appear in the job description (whitespace, case, and curly quotes tolerated)", () => {
  assert.equal(quoteAppears("turn complex  data systems into Product infrastructure", JD), true);
  assert.equal(quoteAppears("ten years of payer contracting", JD), false);
  assert.equal(quoteAppears("data", JD), false); // too short to prove anything
});

test("employers must match a LinkedIn position", () => {
  const positions = [{ company: "Bluebird Care, Inc." }, { company: "Kestrel" }];
  assert.equal(employerKnown("Bluebird Care", positions), true);
  assert.equal(employerKnown("Acme Labs", positions), false);
});

const parts = {
  openingType: "STANDARD" as const,
  evidence: [
    { employer: "Harborline Systems", clause: "lead technical product strategy for an operations platform" },
    { employer: "Bluebird Care", clause: "I directed enterprise initiatives for a conversational AI service." },
  ],
  earlier: { stem: "EARLIER_IN_MY_CAREER" as const, employers: ["Kestrel", "Maple Grid"], clause: "architected identity and platform systems at Kestrel and Maple Grid" },
  capabilities: ["platform architecture", "technical specifications", "shipping enterprise software"],
  strengths: "engineering foundation",
  hook: { text: "Acme's care platform roadmap", quote: "turn complex data systems into product infrastructure" },
  closeStem: "WELCOME" as const,
};

test("standard letters: fixed sentences come from code, in the examples' structure", () => {
  const r = assemble(parts, { company: "Acme", fullName: "Fixture User", referrer: "Priya Raman" });
  assert.ok(r.body.startsWith("Dear Acme,\n\n" + POSITIONING_STATEMENT + " Priya Raman recommended I reach out"));
  assert.match(r.paragraphs[1], /^At Harborline Systems, I lead .* At Bluebird Care, I directed .*\. Earlier in my career, I architected/);
  assert.match(r.paragraphs[2], /^I build with AI tools daily, and I bring deep experience in platform architecture, technical specifications, and shipping enterprise software\. I would welcome the chance to discuss how my engineering foundation can support Acme's care platform roadmap\.$/);
  assert.ok(r.body.endsWith("Best,\nFixture User"));
});

test("length caps come from the examples, counted by code", () => {
  const ok = assemble(parts, { company: "Acme", fullName: "Fixture User" });
  assert.equal(ok.withinCaps, true);
  const long = assemble({ ...parts, strengths: Array(60).fill("word").join(" ") }, { company: "Acme", fullName: "Fixture User" });
  assert.equal(long.withinCaps, false);
  assert.ok(long.over[2] > 0);
  assert.equal(words("one two  three"), 3);
});

test("names and numbers not found in the inputs get flagged", () => {
  const letter = "Dear Acme,\n\nAt Bluebird Care, I grew revenue 40% across Zenith Labs.";
  const flags = unverifiedTerms(letter, ["Bluebird Care", "Acme", JD]);
  assert.ok(flags.includes("40%"));
  assert.ok(flags.includes("Zenith Labs"));
  assert.ok(!flags.includes("Bluebird Care"));
});

test("salutation-style leads aren't flagged, real unknowns still are", () => {
  const flags = unverifiedTerms("At Bluebird Care, I helped. At Zenith Labs, I led.", ["Bluebird Care"]);
  assert.ok(!flags.some((f) => f.startsWith("At ")));
  assert.ok(flags.includes("Zenith Labs"));
});
