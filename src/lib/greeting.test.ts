import { test } from "node:test";
import assert from "node:assert/strict";
import { greetingFor } from "./greeting.ts";

test("greets by time of day", () => {
  assert.equal(greetingFor(7), "Good morning.");
  assert.equal(greetingFor(12), "Good afternoon.");
  assert.equal(greetingFor(16), "Good afternoon.");
  assert.equal(greetingFor(17), "Good evening.");
  assert.equal(greetingFor(23), "Good evening.");
  assert.equal(greetingFor(2), "Good evening.");
});
