import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDraftDuration,
  getDraftPreflight,
} from "../app/lib/draftPreflight.ts";

test("summarizes a multiplayer classic draft", () => {
  const summary = getDraftPreflight({
    playerNames: ["Kai", "Mina"],
    slotNames: Array.from({ length: 10 }, (_, index) => `Slot ${index + 1}`),
    preset: "classic",
    timerDuration: 300,
  });

  assert.deepEqual(
    {
      playerCount: summary.playerCount,
      slotsPerPlayer: summary.slotsPerPlayer,
      totalPicks: summary.totalPicks,
      timerLabel: summary.timerLabel,
      maximumClockLabel: summary.maximumClockLabel,
      presetLabel: summary.presetLabel,
      isSolo: summary.isSolo,
    },
    {
      playerCount: 2,
      slotsPerPlayer: 10,
      totalPicks: 20,
      timerLabel: "5 min",
      maximumClockLabel: "1 hr 40 min",
      presetLabel: "Classic",
      isSolo: false,
    }
  );
});

test("uses preset timing and identifies a solo blitz test", () => {
  const summary = getDraftPreflight({
    playerNames: [" Ash "],
    slotNames: ["Lead", "Rival", "Mascot", "Wildcard", "Tank", "Speed"],
    preset: "blitz",
  });

  assert.equal(summary.playerNames[0], "Ash");
  assert.equal(summary.totalPicks, 6);
  assert.equal(summary.timerSeconds, 60);
  assert.equal(summary.maximumClockLabel, "6 min");
  assert.equal(summary.presetLabel, "Blitz");
  assert.equal(summary.isSolo, true);
});

test("normalizes empty values and formats clock durations", () => {
  const summary = getDraftPreflight({
    playerNames: [],
    slotNames: ["", "  "],
    preset: undefined,
    timerDuration: Number.NaN,
  });

  assert.equal(summary.totalPicks, 0);
  assert.equal(summary.maximumClockLabel, "0 sec");
  assert.equal(summary.presetLabel, "Classic");
  assert.equal(formatDraftDuration(90), "2 min");
  assert.equal(formatDraftDuration(7200), "2 hr");
});

test("keeps the chaos pick timer precise", () => {
  const summary = getDraftPreflight({
    playerNames: ["Mina", "Kai"],
    slotNames: ["Lead"],
    preset: "chaos",
  });

  assert.equal(summary.timerLabel, "90 sec");
  assert.equal(summary.maximumClockLabel, "3 min");
});
