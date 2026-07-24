import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompletedPickCount,
  getRecentDraftActivity,
  isSkippedDraftTurn,
} from "../app/lib/draftActivity.ts";

const character = (id, name) => ({
  id,
  name: { full: name, native: "" },
  gender: "",
  image: { large: `https://images.example/${id}.png` },
  favourites: 0,
});

const history = [
  {
    playerIndex: 0,
    char: character(1, "Goku"),
    slot: "Hero",
    previousRound: 1,
  },
  {
    playerIndex: 1,
    char: character(2, "Bulbasaur"),
    slot: "Starter",
    previousRound: 1,
  },
  {
    playerIndex: 0,
    char: character(-1, "Turn Skipped"),
    slot: "AUTO_SKIP",
    previousRound: 2,
  },
  {
    playerIndex: 1,
    char: character(3, "Luffy"),
    slot: "Captain",
    previousRound: 2,
  },
];

const lobby = {
  players: [
    { name: "Kai", color: "fuchsia" },
    { name: "Mina", color: "sky" },
  ],
  history,
};

test("separates completed picks from skipped turns", () => {
  assert.equal(getCompletedPickCount(history), 3);
  assert.equal(isSkippedDraftTurn(history[2]), true);
  assert.equal(isSkippedDraftTurn(history[1]), false);
});

test("returns the latest activity first with stable pick numbers", () => {
  const activity = getRecentDraftActivity(lobby, 3);

  assert.deepEqual(
    activity.map((event) => ({
      characterName: event.characterName,
      playerName: event.playerName,
      pickNumber: event.pickNumber,
      round: event.round,
    })),
    [
      {
        characterName: "Luffy",
        playerName: "Mina",
        pickNumber: 3,
        round: 2,
      },
      {
        characterName: "Turn skipped",
        playerName: "Kai",
        pickNumber: null,
        round: 2,
      },
      {
        characterName: "Bulbasaur",
        playerName: "Mina",
        pickNumber: 2,
        round: 1,
      },
    ]
  );
});

test("handles old or incomplete activity safely", () => {
  const activity = getRecentDraftActivity(
    {
      players: [],
      history: [
        {
          playerIndex: 2,
          char: character(10, "Mystery Pick"),
          slot: "Wildcard",
        },
      ],
    },
    5
  );

  assert.equal(activity[0].playerName, "Player 3");
  assert.equal(activity[0].round, null);
  assert.deepEqual(getRecentDraftActivity(lobby, 0), []);
});
