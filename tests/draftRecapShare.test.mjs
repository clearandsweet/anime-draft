import assert from "node:assert/strict";
import test from "node:test";

import {
  getDraftRecapRoute,
  getDraftRecapText,
  getDraftRecapTitle,
} from "../app/lib/draftRecapShare.ts";

test("builds permanent recap routes for both draft types", () => {
  assert.equal(
    getDraftRecapRoute("anime", "ABC 123"),
    "/lobby/ABC%20123/vote"
  );
  assert.equal(
    getDraftRecapRoute("pokemon", "PIKA/25"),
    "/pokemon-lobby/PIKA%2F25/vote"
  );
});

test("builds a friendly anime recap with boards and award highlights", () => {
  assert.equal(getDraftRecapTitle("anime", "42"), "Anime Draft #42 Recap");
  assert.equal(
    getDraftRecapText({
      draftType: "anime",
      lobbyId: "42",
      playerNames: [" Kai ", "Mina"],
      completedPicks: 20,
      presetLabel: "Chaos",
      awards: [
        {
          title: "Opening Move",
          characterName: "Naruto",
          playerName: "Kai",
        },
        {
          title: "Fan Favorite",
          characterName: "Gojo",
          playerName: "Mina",
        },
      ],
    }),
    [
      "Anime Draft #42 is complete: 2 players, 20 picks, Chaos format.",
      "Boards: Kai, Mina.",
      "Highlights: Opening Move - Naruto (Kai); Fan Favorite - Gojo (Mina).",
      "See every board, pick, and vote in the permanent recap.",
    ].join("\n")
  );
});

test("handles a minimal Pokémon recap and singular labels", () => {
  assert.equal(
    getDraftRecapTitle("pokemon", "PK1"),
    "Pokémon Draft #PK1 Recap"
  );
  assert.equal(
    getDraftRecapText({
      draftType: "pokemon",
      lobbyId: "PK1",
      playerNames: ["Red", " "],
      completedPicks: 1.8,
      presetLabel: "",
    }),
    [
      "Pokémon Draft #PK1 is complete: 1 player, 1 pick, Classic format.",
      "Boards: Red.",
      "See every board, pick, and vote in the permanent recap.",
    ].join("\n")
  );
});

test("limits highlights and skips incomplete awards", () => {
  const text = getDraftRecapText({
    draftType: "anime",
    lobbyId: "LIMIT",
    playerNames: [],
    completedPicks: -10,
    presetLabel: "Blitz",
    awards: [
      { title: "One", characterName: "A", playerName: "Kai" },
      { title: "Two", characterName: "B", playerName: "Mina" },
      { title: "", characterName: "Skipped", playerName: "Ren" },
      { title: "Three", characterName: "C", playerName: "Ren" },
      { title: "Four", characterName: "D", playerName: "Ari" },
      { title: "Five", characterName: "E", playerName: "Ash" },
    ],
  });

  assert.match(text, /0 players, 0 picks/);
  assert.match(text, /One - A/);
  assert.match(text, /Four - D/);
  assert.doesNotMatch(text, /Five - E/);
  assert.doesNotMatch(text, /Skipped/);
  assert.doesNotMatch(text, /Boards:/);
});

