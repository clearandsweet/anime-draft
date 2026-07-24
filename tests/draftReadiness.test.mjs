import assert from "node:assert/strict";
import test from "node:test";

import {
  getDraftReadiness,
  normalizeReadyPlayerIds,
  setLobbyPlayerReady,
} from "../app/lib/draftReadiness.ts";

const players = [
  { id: "p1", name: "Kai" },
  { id: "p2", name: "Mina" },
  { id: "p3", name: "Ren" },
];

function room() {
  return {
    players: players.map((player) => ({ ...player })),
    readyPlayerIds: [],
    startedAt: null,
    completedAt: null,
    draftActive: false,
    version: 3,
  };
}

test("normalizes readiness to unique players still in the room", () => {
  assert.deepEqual(
    normalizeReadyPlayerIds(["p2", "missing", "p2", 42], players),
    ["p2"]
  );
  assert.deepEqual(normalizeReadyPlayerIds(null, players), []);
});

test("summarizes ready and waiting players", () => {
  const summary = getDraftReadiness(players, ["p1", "p3"]);

  assert.equal(summary.readyCount, 2);
  assert.equal(summary.playerCount, 3);
  assert.equal(summary.allReady, false);
  assert.deepEqual(
    summary.unreadyPlayers.map((player) => player.name),
    ["Mina"]
  );
});

test("lets a joined player toggle their own readiness", () => {
  const state = room();

  assert.deepEqual(setLobbyPlayerReady(state, " mina ", true), { ok: true });
  assert.deepEqual(state.readyPlayerIds, ["p2"]);
  assert.equal(state.version, 4);

  assert.deepEqual(setLobbyPlayerReady(state, "Mina", false), { ok: true });
  assert.deepEqual(state.readyPlayerIds, []);
  assert.equal(state.version, 5);
});

test("does not change version for an idempotent ready update", () => {
  const state = room();
  state.readyPlayerIds = ["p1"];

  assert.deepEqual(setLobbyPlayerReady(state, "Kai", true), { ok: true });
  assert.deepEqual(state.readyPlayerIds, ["p1"]);
  assert.equal(state.version, 3);
});

test("blocks strangers and rooms that already started", () => {
  const state = room();
  assert.deepEqual(setLobbyPlayerReady(state, "Stranger", true), {
    ok: false,
    error: "Join the room before marking ready.",
  });

  state.startedAt = new Date().toISOString();
  state.draftActive = true;
  assert.deepEqual(setLobbyPlayerReady(state, "Kai", true), {
    ok: false,
    error: "Readiness can only change before the draft starts.",
  });
  assert.deepEqual(state.readyPlayerIds, []);
});
