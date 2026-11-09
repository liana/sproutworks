import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCompanyName, boardCodeCandidates } from "./normalize.ts";

test("collapses legal suffixes, punctuation, and parentheticals", () => {
  for (const v of ["Lumen Health", "Lumen Health, Inc.", "Lumen Health (Lumen)", "LUMEN HEALTH LLC"]) {
    assert.equal(normalizeCompanyName(v), "lumen health");
  }
});

test("keeps distinct companies distinct", () => {
  assert.notEqual(normalizeCompanyName("Lumen Health"), normalizeCompanyName("Lumen"));
});

test("board code guesses: joined, dashed, then first word", () => {
  assert.deepEqual(boardCodeCandidates("Quarry AI, Inc."), ["quarryai", "quarry-ai", "quarry"]);
  assert.deepEqual(boardCodeCandidates("Northfield"), ["northfield"]);
});
