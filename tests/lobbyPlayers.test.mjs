import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextPlayerIndex,
  removeLobbyPlayer,
} from "../app/lib/lobbyPlayers.ts";

const player = (id, name) => ({
  id,
  name,
  color: "sky",
  slots: { Lead: null },
  popularityTotal: 0,
});

function roomWithPlayers(...names) {
  return {
    players: names.map((name, index) => player(`p${index + 1}`, name)),
    hostName: names[0] ?? null,
    startedAt: null,
    completedAt: null,
    draftActive: false,
    readyPlayerIds: [],
    version: names.length,
  };
}

test("lets the host remove a guest before launch", () => {
  const room = roomWithPlayers("Kai", "Mina", "Ren");
  room.readyPlayerIds = ["p1", "p2"];
  const versionBefore = room.version;

  const result = removeLobbyPlayer(room, " kai ", "p2");

  assert.deepEqual(result, { ok: true, removedName: "Mina" });
  assert.deepEqual(
    room.players.map((entry) => entry.name),
    ["Kai", "Ren"]
  );
  assert.equal(room.version, versionBefore + 1);
  assert.deepEqual(room.readyPlayerIds, ["p1"]);
});

test("finds the first available id without creating duplicates", () => {
  assert.equal(
    getNextPlayerIndex([
      { id: "p1" },
      { id: "p3" },
      { id: "custom-player" },
    ]),
    1
  );
  assert.equal(getNextPlayerIndex([{ id: "p1" }, { id: "p2" }]), 2);
});

test("protects the host and blocks non-host removals", () => {
  const room = roomWithPlayers("Kai", "Mina");

  assert.deepEqual(removeLobbyPlayer(room, "Mina", "p1"), {
    ok: false,
    error: "Only the host can remove players.",
  });
  assert.deepEqual(removeLobbyPlayer(room, "Kai", "p1"), {
    ok: false,
    error: "The host cannot remove themselves from the room.",
  });
  assert.deepEqual(
    room.players.map((entry) => entry.name),
    ["Kai", "Mina"]
  );
});

test("does not alter active or previously started drafts", () => {
  const activeRoom = roomWithPlayers("Kai", "Mina");
  activeRoom.draftActive = true;
  activeRoom.startedAt = new Date().toISOString();

  const activeResult = removeLobbyPlayer(activeRoom, "Kai", "p2");
  assert.equal(activeResult.ok, false);
  assert.equal(activeRoom.players.length, 2);

  const completedRoom = roomWithPlayers("Kai", "Mina");
  completedRoom.startedAt = new Date().toISOString();
  completedRoom.completedAt = new Date().toISOString();

  const completedResult = removeLobbyPlayer(completedRoom, "Kai", "p2");
  assert.equal(completedResult.ok, false);
  assert.equal(completedRoom.players.length, 2);
});

test("fails safely when the player already left", () => {
  const room = roomWithPlayers("Kai", "Mina");

  assert.deepEqual(removeLobbyPlayer(room, "Kai", "missing"), {
    ok: false,
    error: "That player is no longer in the room.",
  });
  assert.equal(room.players.length, 2);
});
