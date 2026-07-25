import assert from "node:assert/strict";
import test from "node:test";

import {
  getDraftLaunchOrder,
  shuffleDraftPlayerOrder,
} from "../app/lib/draftOrder.ts";

const player = (id, name) => ({
  id,
  name,
  color: "sky",
  slots: { Lead: null },
  popularityTotal: 0,
});

function room() {
  return {
    players: [
      player("p1", "Kai"),
      player("p2", "Mina"),
      player("p3", "Ren"),
    ],
    hostName: "Kai",
    startedAt: null,
    completedAt: null,
    draftActive: false,
    orderShuffled: false,
    version: 4,
  };
}

test("shuffles into a visible preview and preserves player objects", () => {
  const state = room();
  const originalPlayers = [...state.players];

  const result = shuffleDraftPlayerOrder(state, " kai ", () => 0.999);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(
    state.players.map((entry) => entry.id),
    ["p2", "p3", "p1"]
  );
  assert.deepEqual(
    new Set(state.players),
    new Set(originalPlayers)
  );
  assert.equal(state.orderShuffled, true);
  assert.equal(state.version, 5);
});

test("supports repeated host shuffles", () => {
  const state = room();

  assert.equal(shuffleDraftPlayerOrder(state, "Kai", () => 0).ok, true);
  const firstPreview = state.players.map((entry) => entry.id);
  assert.equal(shuffleDraftPlayerOrder(state, "Kai", () => 0).ok, true);

  assert.notDeepEqual(
    state.players.map((entry) => entry.id),
    firstPreview
  );
  assert.equal(state.version, 6);
});

test("launch preserves a previewed order and otherwise keeps automatic randomization", () => {
  const players = room().players;
  const previewed = getDraftLaunchOrder(players, true, () => 0);
  const automatic = getDraftLaunchOrder(players, false, () => 0);

  assert.deepEqual(
    previewed.map((entry) => entry.id),
    ["p1", "p2", "p3"]
  );
  assert.deepEqual(
    automatic.map((entry) => entry.id),
    ["p2", "p3", "p1"]
  );
  assert.notEqual(previewed, players);
  assert.notEqual(automatic, players);
});

test("protects order from guests and active or completed drafts", () => {
  const guestAttempt = room();
  assert.deepEqual(shuffleDraftPlayerOrder(guestAttempt, "Mina"), {
    ok: false,
    error: "Only the host can shuffle draft order.",
  });

  const activeAttempt = room();
  activeAttempt.startedAt = new Date().toISOString();
  activeAttempt.draftActive = true;
  assert.equal(shuffleDraftPlayerOrder(activeAttempt, "Kai").ok, false);

  const completedAttempt = room();
  completedAttempt.completedAt = new Date().toISOString();
  assert.equal(shuffleDraftPlayerOrder(completedAttempt, "Kai").ok, false);

  assert.equal(guestAttempt.version, 4);
  assert.equal(activeAttempt.version, 4);
  assert.equal(completedAttempt.version, 4);
});

test("requires at least two players", () => {
  const state = room();
  state.players = [state.players[0]];

  assert.deepEqual(shuffleDraftPlayerOrder(state, "Kai"), {
    ok: false,
    error: "At least two players are needed to shuffle draft order.",
  });
  assert.equal(state.orderShuffled, false);
  assert.equal(state.version, 4);
});
