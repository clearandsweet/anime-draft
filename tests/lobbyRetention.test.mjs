import assert from "node:assert/strict";
import test from "node:test";

import {
  STALE_EMPTY_LOBBY_MAX_AGE_MS,
  shouldDeleteStaleEmptyLobby,
} from "../app/lib/lobbyRetention.ts";

const now = Date.parse("2026-08-29T12:00:00.000Z");
const oldDate = new Date(
  now - STALE_EMPTY_LOBBY_MAX_AGE_MS - 1
).toISOString();

function lobby(overrides = {}) {
  return {
    status: "active",
    createdAt: oldDate,
    updatedAt: oldDate,
    playersCount: 0,
    lastPickAt: null,
    ...overrides,
  };
}

test("removes only stale empty rooms", () => {
  assert.equal(shouldDeleteStaleEmptyLobby(lobby(), now), true);
  assert.equal(
    shouldDeleteStaleEmptyLobby(lobby({ updatedAt: new Date(now).toISOString() }), now),
    false
  );
});

test("keeps completed and played rooms indefinitely", () => {
  assert.equal(
    shouldDeleteStaleEmptyLobby(lobby({ status: "completed" }), now),
    false
  );
  assert.equal(
    shouldDeleteStaleEmptyLobby(lobby({ playersCount: 2 }), now),
    false
  );
  assert.equal(
    shouldDeleteStaleEmptyLobby(lobby({ lastPickAt: oldDate }), now),
    false
  );
});
