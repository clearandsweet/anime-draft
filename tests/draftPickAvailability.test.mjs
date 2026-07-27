import assert from "node:assert/strict";
import test from "node:test";

const { getDraftPickAvailability } = await import(
  "../app/lib/draftPickAvailability.ts"
);

const activeTurn = {
  draftActive: true,
  isPaused: false,
  completedAt: null,
  currentPlayerName: "Kai",
  viewerName: "kai",
  viewerOpenSlotCount: 3,
};

test("allows only the current player with an open category to pick", () => {
  assert.deepEqual(getDraftPickAvailability(activeTurn), {
    canPick: true,
    label: "You're on the clock",
    detail: "3 open categories on your board.",
    tone: "ready",
  });
  assert.equal(
    getDraftPickAvailability({
      ...activeTurn,
      currentPlayerName: "Mina",
    }).canPick,
    false
  );
  assert.equal(
    getDraftPickAvailability({ ...activeTurn, viewerOpenSlotCount: 0 }).tone,
    "full"
  );
});

test("explains paused, completed, and spectator states", () => {
  assert.equal(
    getDraftPickAvailability({ ...activeTurn, isPaused: true }).tone,
    "paused"
  );
  assert.equal(
    getDraftPickAvailability({
      ...activeTurn,
      draftActive: false,
      completedAt: "2026-07-26T12:00:00.000Z",
    }).tone,
    "complete"
  );
  assert.deepEqual(
    getDraftPickAvailability({ ...activeTurn, viewerName: "" }),
    {
      canPick: false,
      label: "Kai is on the clock",
      detail: "Join as a player to make picks. Scouting remains available.",
      tone: "watching",
    }
  );
});
