import assert from "node:assert/strict";
import test from "node:test";

const identity = await import("../app/lib/lobbyIdentity.ts");

test("remembers, scopes, and forgets a lobby identity", () => {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      setItem: (key, value) => values.set(key, value),
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
    },
  };

  assert.equal(identity.getLobbyIdentity("anime-42"), "");
  assert.equal(identity.rememberLobbyIdentity("anime-42", "  Kai  "), true);
  assert.equal(identity.getLobbyIdentity("anime-42"), "Kai");
  assert.equal(identity.getLobbyIdentity("pokemon-42"), "");

  identity.forgetLobbyIdentity("anime-42");
  assert.equal(identity.getLobbyIdentity("anime-42"), "");
});

test("fails safely when browser storage is unavailable", () => {
  globalThis.window = {
    localStorage: {
      setItem: () => {
        throw new Error("storage denied");
      },
      getItem: () => {
        throw new Error("storage denied");
      },
      removeItem: () => {
        throw new Error("storage denied");
      },
    },
  };

  assert.equal(identity.rememberLobbyIdentity("9", "Misty"), false);
  assert.equal(identity.getLobbyIdentity("9"), "");
  assert.doesNotThrow(() => identity.forgetLobbyIdentity("9"));
});
