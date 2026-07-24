import assert from "node:assert/strict";
import test from "node:test";

const { getOpenSlotNames, getUpcomingDraftTurns } = await import(
  "../app/lib/draftTurns.ts"
);

test("previews forward, back-to-back, and reverse snake turns", () => {
  assert.deepEqual(getUpcomingDraftTurns(4, 0, 1, 6), [
    { playerIndex: 1, round: 1 },
    { playerIndex: 2, round: 1 },
    { playerIndex: 3, round: 1 },
    { playerIndex: 3, round: 2 },
    { playerIndex: 2, round: 2 },
    { playerIndex: 1, round: 2 },
  ]);
});

test("bounces correctly from the reverse-round edge", () => {
  assert.deepEqual(getUpcomingDraftTurns(3, 0, 2, 4), [
    { playerIndex: 0, round: 3 },
    { playerIndex: 1, round: 3 },
    { playerIndex: 2, round: 3 },
    { playerIndex: 2, round: 4 },
  ]);
});

test("handles solo and empty rooms", () => {
  assert.deepEqual(getUpcomingDraftTurns(1, 0, 1, 3), [
    { playerIndex: 0, round: 2 },
    { playerIndex: 0, round: 3 },
    { playerIndex: 0, round: 4 },
  ]);
  assert.deepEqual(getUpcomingDraftTurns(0, 0, 1, 4), []);
});

test("offers only category slots that are still open", () => {
  assert.deepEqual(
    getOpenSlotNames({
      Leader: { id: 25 },
      Rival: null,
      Wildcard: undefined,
      Mascot: { id: 133 },
    }),
    ["Rival", "Wildcard"]
  );
});
