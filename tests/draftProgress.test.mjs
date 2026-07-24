import assert from "node:assert/strict";
import test from "node:test";

import { getDraftProgress } from "../app/lib/draftProgress.ts";

const player = (id, name, slots) => ({
  id,
  name,
  color: "sky",
  slots,
  popularityTotal: 0,
});

test("summarizes overall and per-player board progress", () => {
  const progress = getDraftProgress([
    player("one", "Kai", {
      Hero: { id: 1 },
      Villain: null,
      Mentor: { id: 2 },
    }),
    player("two", "Mina", {
      Hero: null,
      Villain: null,
      Mentor: { id: 3 },
    }),
  ]);

  assert.deepEqual(
    {
      filledSlots: progress.filledSlots,
      totalSlots: progress.totalSlots,
      remainingSlots: progress.remainingSlots,
      percentage: progress.percentage,
    },
    {
      filledSlots: 3,
      totalSlots: 6,
      remainingSlots: 3,
      percentage: 50,
    }
  );
  assert.deepEqual(
    progress.players.map((entry) => ({
      name: entry.name,
      filledSlots: entry.filledSlots,
      remainingSlots: entry.remainingSlots,
    })),
    [
      { name: "Kai", filledSlots: 2, remainingSlots: 1 },
      { name: "Mina", filledSlots: 1, remainingSlots: 2 },
    ]
  );
});

test("handles empty rooms and completed boards", () => {
  assert.deepEqual(getDraftProgress([]), {
    filledSlots: 0,
    totalSlots: 0,
    remainingSlots: 0,
    percentage: 0,
    players: [],
  });

  const complete = getDraftProgress([
    player("solo", "Solo", {
      Lead: { id: 1 },
      Rival: { id: 2 },
    }),
  ]);

  assert.equal(complete.remainingSlots, 0);
  assert.equal(complete.percentage, 100);
});
