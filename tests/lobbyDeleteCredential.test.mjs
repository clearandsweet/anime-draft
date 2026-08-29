import assert from "node:assert/strict";
import test from "node:test";

import {
  generateManageKey,
  hashManageKey,
  verifyLobbyDeleteCredential,
} from "../app/api/lobby/manageKey.ts";

test("accepts either the room key or the deletion password", () => {
  const roomKey = generateManageKey();
  const roomKeyHash = hashManageKey(roomKey);

  assert.equal(
    verifyLobbyDeleteCredential(roomKey, roomKeyHash, "delete"),
    true
  );
  assert.equal(
    verifyLobbyDeleteCredential("delete", roomKeyHash, "delete"),
    true
  );
  assert.equal(
    verifyLobbyDeleteCredential("wrong", roomKeyHash, "delete"),
    false
  );
});
