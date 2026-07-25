import assert from "node:assert/strict";
import test from "node:test";

import { rerollLobbyCategory } from "../app/lib/draftCategories.ts";

function room() {
  return {
    players: [
      {
        id: "p1",
        name: "Kai",
        color: "sky",
        slots: { Lead: null, Rival: null, Mascot: null },
        popularityTotal: 0,
      },
    ],
    hostName: "Kai",
    startedAt: null,
    completedAt: null,
    draftActive: false,
    categoryMode: "random",
    slotNames: ["Lead", "Rival", "Mascot"],
    version: 4,
  };
}

test("replaces one random category while preserving the rest", () => {
  const state = room();
  const result = rerollLobbyCategory(
    state,
    " kai ",
    "Rival",
    ["Lead", "Rival", "Mascot", "Mentor", "Wildcard"],
    0
  );

  assert.deepEqual(result, {
    ok: true,
    previousSlot: "Rival",
    nextSlot: "Mentor",
  });
  assert.deepEqual(state.slotNames, ["Lead", "Mentor", "Mascot"]);
  assert.deepEqual(Object.keys(state.players[0].slots), [
    "Lead",
    "Mentor",
    "Mascot",
  ]);
  assert.equal(state.version, 5);
});

test("never introduces a duplicate category", () => {
  const state = room();
  const result = rerollLobbyCategory(
    state,
    "Kai",
    "Lead",
    ["Lead", "Rival", "Mascot", "Wildcard", "Wildcard"],
    0.99
  );

  assert.equal(result.ok, true);
  assert.equal(result.nextSlot, "Wildcard");
  assert.equal(new Set(state.slotNames).size, state.slotNames.length);
});

test("requires the host and random mode", () => {
  const state = room();
  assert.deepEqual(
    rerollLobbyCategory(state, "Mina", "Lead", ["Lead", "Wildcard"]),
    {
      ok: false,
      error: "Only the host can reroll categories.",
    }
  );

  state.categoryMode = "default";
  assert.deepEqual(
    rerollLobbyCategory(state, "Kai", "Lead", ["Lead", "Wildcard"]),
    {
      ok: false,
      error: "Switch to random categories before rerolling one slot.",
    }
  );
});

test("protects started drafts and stale category requests", () => {
  const activeState = room();
  activeState.startedAt = new Date().toISOString();
  activeState.draftActive = true;
  assert.equal(
    rerollLobbyCategory(
      activeState,
      "Kai",
      "Lead",
      ["Lead", "Wildcard"]
    ).ok,
    false
  );

  const staleState = room();
  assert.deepEqual(
    rerollLobbyCategory(
      staleState,
      "Kai",
      "Missing",
      ["Lead", "Wildcard"]
    ),
    {
      ok: false,
      error: "That category is no longer on the board.",
    }
  );
});

test("fails safely when the pool has no unused alternatives", () => {
  const state = room();
  assert.deepEqual(
    rerollLobbyCategory(
      state,
      "Kai",
      "Lead",
      ["Lead", "Rival", "Mascot"]
    ),
    {
      ok: false,
      error: "No unused categories are available.",
    }
  );
});
