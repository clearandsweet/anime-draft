import assert from "node:assert/strict";
import test from "node:test";

const {
  getDraftScoutSlotPlans,
  getDraftScoutCoverage,
  filterDraftScoutCandidateIds,
  getDraftShortlist,
  getUnavailableShortlistIds,
  moveShortlistId,
  normalizeDraftScoutSlotPlans,
  normalizeShortlistIds,
  pruneDraftScoutSlotPlans,
  rememberDraftScoutSlotPlans,
  rememberDraftShortlist,
  removeDraftedShortlistIds,
  setDraftScoutSlotPlan,
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
  assert.deepEqual(getUnavailableShortlistIds([25, 94, 133], [94, 999]), [
    94,
  ]);
  assert.deepEqual(getUnavailableShortlistIds([25, 25, 94], [25, 94]), [
    25,
    94,
  ]);
});

test("moves saved candidates without losing or duplicating priorities", () => {
  assert.deepEqual(moveShortlistId([25, 94, 133], 94, "up"), [94, 25, 133]);
  assert.deepEqual(moveShortlistId([25, 94, 133], 94, "down"), [25, 133, 94]);
  assert.deepEqual(moveShortlistId([25, 94, 133], 25, "up"), [25, 94, 133]);
  assert.deepEqual(moveShortlistId([25, 94, 133], 133, "down"), [25, 94, 133]);
  assert.deepEqual(moveShortlistId([25, 25, 94], 999, "up"), [25, 94]);
});

test("normalizes, updates, and prunes private category plans", () => {
  assert.deepEqual(
    normalizeDraftScoutSlotPlans({
      25: "  Mascot  ",
      94: "Ghost / Dark",
      "-1": "Invalid",
      nope: "Invalid",
      133: "",
      150: 42,
    }),
    {
      25: "Mascot",
      94: "Ghost / Dark",
    }
  );

  const planned = setDraftScoutSlotPlan({}, 25, "Little Guy");
  assert.deepEqual(planned, { 25: "Little Guy" });
  assert.deepEqual(setDraftScoutSlotPlan(planned, 25, ""), {});
  assert.deepEqual(
    pruneDraftScoutSlotPlans(
      { 25: "Little Guy", 94: "Ghost / Dark", 133: "Wildcard" },
      [94, 133]
    ),
    { 94: "Ghost / Dark", 133: "Wildcard" }
  );
});

test("summarizes Scout coverage across the viewer's open categories", () => {
  assert.deepEqual(
    getDraftScoutCoverage(
      [25, 94, 133, 150],
      {
        25: "Mascot",
        94: "Ghost / Dark",
        133: "Mascot",
        150: "Already filled",
      },
      ["Mascot", "Ghost / Dark", "Wildcard", "Mascot"]
    ),
    {
      queuedCandidateCount: 4,
      openSlotCount: 3,
      coveredSlotCount: 2,
      needsOpenPlanCount: 1,
      slots: [
        { name: "Mascot", candidateCount: 2 },
        { name: "Ghost / Dark", candidateCount: 1 },
        { name: "Wildcard", candidateCount: 0 },
      ],
    }
  );
  assert.equal(getDraftScoutCoverage([], {}, ["Mascot"]).coveredSlotCount, 0);
});

test("focuses Scout candidates on one planned category", () => {
  assert.deepEqual(
    filterDraftScoutCandidateIds(
      [25, 94, 133, 150],
      {
        25: "Mascot",
        94: "Ghost / Dark",
        133: "Mascot",
      },
      "Mascot"
    ),
    [25, 133]
  );
  assert.deepEqual(
    filterDraftScoutCandidateIds([25, 94], { 25: "Mascot" }, ""),
    [25, 94]
  );
  assert.deepEqual(
    filterDraftScoutCandidateIds([25, 94], { 25: "Mascot" }, "Wildcard"),
    []
  );
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

  assert.equal(
    rememberDraftScoutSlotPlans("anime", "42", {
      1: "Waifu",
      2: "Wildcard",
    }),
    true
  );
  assert.equal(
    rememberDraftScoutSlotPlans("pokemon", "42", {
      25: "Little Guy",
    }),
    true
  );
  assert.deepEqual(getDraftScoutSlotPlans("anime", "42"), {
    1: "Waifu",
    2: "Wildcard",
  });
  assert.deepEqual(getDraftScoutSlotPlans("pokemon", "42"), {
    25: "Little Guy",
  });

  assert.equal(rememberDraftShortlist("anime", "42", []), true);
  assert.deepEqual(getDraftShortlist("anime", "42"), []);
  assert.equal(rememberDraftScoutSlotPlans("anime", "42", {}), true);
  assert.deepEqual(getDraftScoutSlotPlans("anime", "42"), {});
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
  assert.equal(
    rememberDraftScoutSlotPlans("pokemon", "9", { 25: "Mascot" }),
    false
  );
  assert.deepEqual(getDraftScoutSlotPlans("pokemon", "9"), {});
});
