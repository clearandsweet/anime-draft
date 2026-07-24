import assert from "node:assert/strict";
import test from "node:test";

const {
  getDraftShortlist,
  normalizeShortlistIds,
  rememberDraftShortlist,
  removeDraftedShortlistIds,
  toggleShortlistId,
} = await import("../app/lib/draftShortlist.ts");

test("normalizes, toggles, and removes drafted shortlist entries", () => {
  assert.deepEqual(normalizeShortlistIds([25, 25, -1, "6", 94]), [25, 94]);
  assert.deepEqual(toggleShortlistId([25], 94), [25, 94]);
  assert.deepEqual(toggleShortlistId([25, 94], 25), [94]);
  assert.deepEqual(removeDraftedShortlistIds([25, 94, 133], [94, 999]), [
    25,
    133,
  ]);
});

test("stores shortlist entries separately by room and draft type", () => {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      setItem: (key, value) => values.set(key, value),
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
    },
  };

  assert.equal(rememberDraftShortlist("anime", "42", [1, 2]), true);
  assert.equal(rememberDraftShortlist("pokemon", "42", [25]), true);
  assert.deepEqual(getDraftShortlist("anime", "42"), [1, 2]);
  assert.deepEqual(getDraftShortlist("pokemon", "42"), [25]);
  assert.deepEqual(getDraftShortlist("anime", "43"), []);

  assert.equal(rememberDraftShortlist("anime", "42", []), true);
  assert.deepEqual(getDraftShortlist("anime", "42"), []);
});

test("fails safely when device storage is unavailable", () => {
  globalThis.window = {
    localStorage: {
      setItem: () => {
        throw new Error("storage denied");
      },
      getItem: () => {
        throw new Error("storage denied");
      },
      removeItem: () => {
        throw new Error("storage denied");
      },
    },
  };

  assert.equal(rememberDraftShortlist("pokemon", "9", [25]), false);
  assert.deepEqual(getDraftShortlist("pokemon", "9"), []);
});
