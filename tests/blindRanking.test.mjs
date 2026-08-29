import assert from "node:assert/strict";
import test from "node:test";
import {
  createBlindRankingBoard,
  mergeBlindRankingCandidates,
  normalizeBlindRankingGenres,
  normalizeBlindRankingStatuses,
  placeBlindRankingItem,
  selectBlindRankingItems,
} from "../app/lib/blindRanking.ts";
import {
  addBlindRankingParticipant,
  createBlindRankingRoomState,
  placeCurrentBlindRankingItem,
  startBlindRankingRoom,
  toPublicBlindRankingRoom,
} from "../app/lib/blindRankingRoom.ts";

function item(id, title = id) {
  return {
    id,
    title,
    image: `${id}.jpg`,
    subtitle: "TV · 2024",
    genres: ["Drama"],
    sourceUrl: `https://example.com/${id}`,
  };
}

function participant(id, name) {
  return {
    id,
    name,
    source: null,
    tokenHash: `hash-${id}`,
    joinedAt: "2026-08-29T00:00:00.000Z",
  };
}

const config = {
  mode: "anime",
  count: 5,
  genres: [],
  statuses: ["completed", "watching", "planning", "dropped"],
};

test("normalizes public filter inputs to supported values", () => {
  assert.deepEqual(normalizeBlindRankingGenres(["Drama", "Fake", "Drama"]), [
    "Drama",
  ]);
  assert.deepEqual(normalizeBlindRankingStatuses(["completed", "bogus"]), [
    "completed",
  ]);
  assert.equal(normalizeBlindRankingStatuses([]).length, 4);
});

test("unions participant pools and records every contributor", () => {
  const merged = mergeBlindRankingCandidates([
    { contributor: "Kai", items: [item("a"), item("b")] },
    { contributor: "Maya", items: [item("b"), item("c")] },
  ]);
  assert.deepEqual(
    merged.map((entry) => entry.id),
    ["a", "b", "c"]
  );
  assert.deepEqual(merged[1].contributors, ["Kai", "Maya"]);
});

test("seeded selection is stable and does not mutate the candidate pool", () => {
  const candidates = Array.from({ length: 12 }, (_, index) => item(String(index)));
  const before = candidates.map((entry) => entry.id);
  const first = selectBlindRankingItems(candidates, 5, "room-seed");
  const second = selectBlindRankingItems(candidates, 5, "room-seed");
  assert.deepEqual(first, second);
  assert.deepEqual(
    candidates.map((entry) => entry.id),
    before
  );
  assert.equal(new Set(first.map((entry) => entry.id)).size, 5);
});

test("a blind placement fills only an open valid slot", () => {
  const board = createBlindRankingBoard(5);
  const first = placeBlindRankingItem(board, 2, item("a"));
  assert.equal(first.ok, true);
  assert.equal(first.board[2]?.id, "a");
  assert.equal(board[2], null);
  assert.deepEqual(placeBlindRankingItem(first.board, 2, item("b")), {
    ok: false,
    error: "That ranking slot is already locked.",
  });
  assert.equal(placeBlindRankingItem(first.board, 7, item("b")).ok, false);
});

test("room participants can only join before play and names are unique", () => {
  const room = createBlindRankingRoomState("ABC234", config, participant("p1", "Kai"));
  assert.equal(addBlindRankingParticipant(room, participant("p2", "Maya")).ok, true);
  assert.equal(addBlindRankingParticipant(room, participant("p3", "maya")).ok, false);
  startBlindRankingRoom(
    room,
    Array.from({ length: 5 }, (_, index) => item(String(index)))
  );
  assert.equal(addBlindRankingParticipant(room, participant("p4", "Rin")).ok, false);
});

test("room reveals advance one at a time and complete on the last lock", () => {
  const room = createBlindRankingRoomState("ABC234", config, participant("p1", "Kai"));
  const items = Array.from({ length: 5 }, (_, index) => item(String(index)));
  assert.equal(startBlindRankingRoom(room, items).ok, true);
  assert.equal(room.status, "playing");
  assert.equal(room.currentIndex, 0);

  for (let index = 0; index < 5; index += 1) {
    const result = placeCurrentBlindRankingItem(room, "p1", index);
    assert.equal(result.ok, true);
    assert.equal(room.currentIndex, index + 1);
  }
  assert.equal(room.status, "complete");
  assert.ok(room.completedAt);
  assert.deepEqual(room.board.map((entry) => entry?.id), ["0", "1", "2", "3", "4"]);
});

test("public room responses hide participant credentials and unrevealed pool", () => {
  const room = createBlindRankingRoomState("ABC234", config, participant("p1", "Kai"));
  room.pool = Array.from({ length: 5 }, (_, index) => item(String(index)));
  const publicRoom = toPublicBlindRankingRoom(room);
  assert.equal("pool" in publicRoom, false);
  assert.equal("tokenHash" in publicRoom.participants[0], false);
  assert.equal(publicRoom.currentItem?.id, "0");
  assert.equal(publicRoom.totalItems, 5);
});
