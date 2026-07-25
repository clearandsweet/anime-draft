import assert from "node:assert/strict";
import test from "node:test";

import {
  combineDeviceLobbyIds,
  filterDraftRooms,
} from "../app/lib/draftRoomDiscovery.ts";

const rooms = [
  {
    id: "101",
    hostName: "Kai",
    status: "completed",
    preset: "classic",
  },
  {
    id: "202",
    hostName: "Mina",
    status: "active",
    preset: "chaos",
  },
  {
    id: "303",
    hostName: null,
    status: "completed",
    preset: "blitz",
  },
];

test("combines hosted and joined room ids without duplicates", () => {
  assert.deepEqual(
    [...combineDeviceLobbyIds(new Set(["101", "202"]), new Set(["202", "303"]))],
    ["101", "202", "303"]
  );
});

test("filters rooms remembered on this device", () => {
  assert.deepEqual(
    filterDraftRooms(rooms, {
      deviceOnly: true,
      deviceLobbyIds: new Set(["101", "303"]),
    }).map((room) => room.id),
    ["101", "303"]
  );
});

test("searches room numbers, hosts, formats, and status language", () => {
  assert.deepEqual(
    filterDraftRooms(rooms, { query: "mina" }).map((room) => room.id),
    ["202"]
  );
  assert.deepEqual(
    filterDraftRooms(rooms, { query: "303" }).map((room) => room.id),
    ["303"]
  );
  assert.deepEqual(
    filterDraftRooms(rooms, { query: "chaos" }).map((room) => room.id),
    ["202"]
  );
  assert.deepEqual(
    filterDraftRooms(rooms, { query: "recap" }).map((room) => room.id),
    ["101", "303"]
  );
});

test("combines device and search filters without mutating room order", () => {
  const original = structuredClone(rooms);
  assert.deepEqual(
    filterDraftRooms(rooms, {
      query: "final",
      deviceOnly: true,
      deviceLobbyIds: new Set(["202", "303"]),
    }).map((room) => room.id),
    ["303"]
  );
  assert.deepEqual(rooms, original);
});

