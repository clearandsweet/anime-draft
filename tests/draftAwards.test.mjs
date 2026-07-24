import assert from "node:assert/strict";
import test from "node:test";

import { getDraftAwards } from "../app/lib/draftAwards.ts";

const character = (id, name, favourites) => ({
  id,
  name: { full: name },
  image: { large: `https://images.example/${id}.png` },
  favourites,
});

const players = [
  { name: "Kai", color: "fuchsia" },
  { name: "Mina", color: "sky" },
];

test("creates varied deterministic awards and ignores skipped turns", () => {
  const awards = getDraftAwards(
    [
      { playerIndex: 0, char: character(-1, "Skipped", 0), slot: "AUTO_SKIP" },
      { playerIndex: 1, char: character(1, "Opening", 40), slot: "Hero" },
      { playerIndex: 0, char: character(2, "Popular", 900), slot: "Lead" },
      { playerIndex: 1, char: character(3, "Obscure", 2), slot: "Wildcard" },
      { playerIndex: 0, char: character(4, "Closer", 120), slot: "Rival" },
    ],
    players
  );

  assert.deepEqual(
    awards.map((award) => ({
      id: award.id,
      characterName: award.characterName,
      playerName: award.playerName,
      pickNumber: award.pickNumber,
    })),
    [
      {
        id: "opening-move",
        characterName: "Opening",
        playerName: "Mina",
        pickNumber: 1,
      },
      {
        id: "fan-favorite",
        characterName: "Popular",
        playerName: "Kai",
        pickNumber: 2,
      },
      {
        id: "deep-cut",
        characterName: "Obscure",
        playerName: "Mina",
        pickNumber: 3,
      },
      {
        id: "final-flourish",
        characterName: "Closer",
        playerName: "Kai",
        pickNumber: 4,
      },
    ]
  );
});

test("deduplicates awards when one pick qualifies more than once", () => {
  const awards = getDraftAwards(
    [{ playerIndex: 0, char: character(25, "Pikachu", 500), slot: "Mascot" }],
    players
  );

  assert.equal(awards.length, 1);
  assert.equal(awards[0].id, "opening-move");
  assert.equal(awards[0].characterName, "Pikachu");
});

test("supports old archives without popularity or player metadata", () => {
  const awards = getDraftAwards(
    [
      {
        playerIndex: 3,
        char: { id: 9, name: { full: "Mystery" } },
        slot: "Wildcard",
      },
      {
        playerIndex: 3,
        char: { id: 10, name: { full: "Final Mystery" } },
        slot: "Closer",
      },
    ],
    []
  );

  assert.deepEqual(
    awards.map((award) => [award.id, award.playerName]),
    [
      ["opening-move", "Player 4"],
      ["final-flourish", "Player 4"],
    ]
  );
});
