import assert from "node:assert/strict";
import test from "node:test";

import {
  getDraftUndoPreview,
  isDraftUndoExpectation,
  matchesDraftUndoExpectation,
} from "../app/lib/draftUndo.ts";

const gengar = {
  id: 94,
  name: { full: "Gengar", native: "ゲンガー" },
  gender: "Unknown",
  image: { large: "https://example.com/gengar.png" },
  favourites: 900,
};

function lobbyWith(history, overrides = {}) {
  return {
    history,
    players: [
      {
        id: "p1",
        name: "Kai",
        color: "fuchsia",
        slots: { Mascot: gengar },
        popularityTotal: 900,
      },
    ],
    completedAt: null,
    ...overrides,
  };
}

test("previews the exact pick that will be undone", () => {
  const entry = {
    playerIndex: 0,
    char: gengar,
    slot: "Mascot",
    previousRound: 2,
    previousCurrentPlayerIndex: 0,
  };

  assert.deepEqual(getDraftUndoPreview(lobbyWith([entry])), {
    kind: "pick",
    playerName: "Kai",
    playerColor: "fuchsia",
    characterName: "Gengar",
    imageUrl: "https://example.com/gengar.png",
    slot: "Mascot",
    reopensCompletedDraft: false,
    expectation: {
      historyLength: 1,
      playerIndex: 0,
      characterId: 94,
      slot: "Mascot",
    },
  });
});

test("explains skipped turns and completed-draft reopening", () => {
  const skippedEntry = {
    playerIndex: 0,
    char: {
      id: -1,
      name: { full: "Skipped Turn", native: "" },
      gender: "",
      image: { large: "" },
      favourites: 0,
    },
    slot: "AUTO_SKIP",
  };

  const preview = getDraftUndoPreview(
    lobbyWith([skippedEntry], { completedAt: "2026-07-24T12:00:00.000Z" })
  );

  assert.equal(preview.kind, "skip");
  assert.equal(preview.characterName, "Skipped turn");
  assert.equal(preview.slot, "Timer expired");
  assert.equal(preview.imageUrl, "");
  assert.equal(preview.reopensCompletedDraft, true);
});

test("rejects stale confirmations when the latest history changes", () => {
  const gengarEntry = {
    playerIndex: 0,
    char: gengar,
    slot: "Mascot",
  };
  const expectation = getDraftUndoPreview(lobbyWith([gengarEntry])).expectation;
  const newerEntry = {
    playerIndex: 0,
    char: { ...gengar, id: 25, name: { full: "Pikachu", native: "ピカチュウ" } },
    slot: "Wildcard",
  };

  assert.equal(matchesDraftUndoExpectation([gengarEntry], expectation), true);
  assert.equal(
    matchesDraftUndoExpectation([gengarEntry, newerEntry], expectation),
    false
  );
  assert.equal(matchesDraftUndoExpectation([newerEntry], expectation), false);
});

test("validates undo confirmations before accepting them", () => {
  assert.equal(
    isDraftUndoExpectation({
      historyLength: 2,
      playerIndex: 0,
      characterId: -1,
      slot: "AUTO_SKIP",
    }),
    true
  );
  assert.equal(
    isDraftUndoExpectation({
      historyLength: 0,
      playerIndex: 0,
      characterId: 94,
      slot: "Mascot",
    }),
    false
  );
  assert.equal(isDraftUndoExpectation({ historyLength: 1 }), false);
});
