import assert from "node:assert/strict";
import test from "node:test";

import {
  getLobbyInviteText,
  getLobbyInviteTitle,
  getLobbyRoute,
} from "../app/lib/lobbyInvite.ts";

test("builds the correct lobby route for each draft type", () => {
  assert.equal(getLobbyRoute("anime", "ABC 123"), "/lobby/ABC%20123");
  assert.equal(
    getLobbyRoute("pokemon", "PIKA/25"),
    "/pokemon-lobby/PIKA%2F25"
  );
});

test("builds friendly anime invite copy with a host", () => {
  assert.equal(
    getLobbyInviteTitle("anime"),
    "Join my anime character draft"
  );
  assert.equal(
    getLobbyInviteText("anime", "ANIME42", "  Kira "),
    "Kira invited you to an anime character draft in room #ANIME42."
  );
});

test("builds friendly Pokémon invite copy without a host", () => {
  assert.equal(getLobbyInviteTitle("pokemon"), "Join my Pokémon draft");
  assert.equal(
    getLobbyInviteText("pokemon", "PKMN25"),
    "Join this Pokémon draft in room #PKMN25."
  );
});
