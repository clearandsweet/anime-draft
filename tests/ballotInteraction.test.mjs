import assert from "node:assert/strict";
import test from "node:test";

import { isBallotActivationKey } from "../app/lib/ballotInteraction.ts";

test("recognizes keyboard activation keys for ballot cards", () => {
  assert.equal(isBallotActivationKey("Enter"), true);
  assert.equal(isBallotActivationKey(" "), true);
  assert.equal(isBallotActivationKey("Spacebar"), true);
});

test("ignores navigation and modifier keys", () => {
  assert.equal(isBallotActivationKey("Tab"), false);
  assert.equal(isBallotActivationKey("ArrowDown"), false);
  assert.equal(isBallotActivationKey("Escape"), false);
});
