import assert from "node:assert/strict";
import test from "node:test";

const {
  getRequiredVoteSelections,
  tallyVotes,
} = await import("../app/api/lobby/votesLogic.ts");

test("requires a valid number of ranked boards for every room size", () => {
  assert.equal(getRequiredVoteSelections(0), 0);
  assert.equal(getRequiredVoteSelections(1), 1);
  assert.equal(getRequiredVoteSelections(2), 1);
  assert.equal(getRequiredVoteSelections(3), 3);
  assert.equal(getRequiredVoteSelections(8), 3);
});

test("tallies ranked ballots without changing the stored records", () => {
  const records = [
    {
      id: "vote-1",
      ipHash: "one",
      first: "p1",
      second: "p2",
      third: "p3",
      createdAt: "2026-07-24T00:00:00.000Z",
    },
    {
      id: "vote-2",
      ipHash: "two",
      first: "p2",
      second: "p1",
      third: "p3",
      createdAt: "2026-07-24T00:01:00.000Z",
    },
  ];

  assert.deepEqual(tallyVotes(records, ["p1", "p2", "p3"]), {
    ballots: 2,
    totals: {
      p1: { first: 1, second: 1, third: 0, points: 5 },
      p2: { first: 1, second: 1, third: 0, points: 5 },
      p3: { first: 0, second: 0, third: 2, points: 2 },
    },
  });
  assert.equal(records[0].first, "p1");
});
