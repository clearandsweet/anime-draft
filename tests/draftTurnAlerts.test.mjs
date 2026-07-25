import assert from "node:assert/strict";
import test from "node:test";

const alerts = await import("../app/lib/draftTurnAlerts.ts");

test("creates a distinct key for back-to-back turns", () => {
  assert.equal(alerts.getDraftTurnKey(1, "p3", 2), "1:p3:2");
  assert.equal(alerts.getDraftTurnKey(2, "p3", 3), "2:p3:3");
  assert.notEqual(
    alerts.getDraftTurnKey(1, "p3", 2),
    alerts.getDraftTurnKey(2, "p3", 3)
  );
});

test("announces only a new active unpaused turn for the viewer", () => {
  const base = {
    enabled: true,
    draftActive: true,
    isPaused: false,
    viewerName: " Kai ",
    currentPlayerName: "kai",
    previousTurnKey: "1:p2:2",
    currentTurnKey: "1:p1:3",
  };

  assert.equal(alerts.shouldAnnounceDraftTurn(base), true);
  assert.equal(
    alerts.shouldAnnounceDraftTurn({ ...base, enabled: false }),
    false
  );
  assert.equal(
    alerts.shouldAnnounceDraftTurn({ ...base, draftActive: false }),
    false
  );
  assert.equal(
    alerts.shouldAnnounceDraftTurn({ ...base, isPaused: true }),
    false
  );
  assert.equal(
    alerts.shouldAnnounceDraftTurn({
      ...base,
      currentPlayerName: "Mina",
    }),
    false
  );
  assert.equal(
    alerts.shouldAnnounceDraftTurn({
      ...base,
      currentTurnKey: base.previousTurnKey,
    }),
    false
  );
});

test("builds draft-specific notification copy", () => {
  assert.equal(
    alerts.getDraftTurnAlertBody("anime", "42", "Kai"),
    "Kai, it is your turn in Anime Draft #42."
  );
  assert.equal(
    alerts.getDraftTurnAlertBody("pokemon", "25", " Misty "),
    "Misty, it is your turn in Pokémon Draft #25."
  );
});

test("remembers the device preference and removes it when disabled", () => {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      setItem: (key, value) => values.set(key, value),
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
    },
  };

  assert.equal(alerts.getTurnAlertsEnabled(), false);
  assert.equal(alerts.rememberTurnAlertsEnabled(true), true);
  assert.equal(alerts.getTurnAlertsEnabled(), true);
  assert.equal(alerts.rememberTurnAlertsEnabled(false), true);
  assert.equal(alerts.getTurnAlertsEnabled(), false);
});

test("fails safely when device storage is unavailable", () => {
  globalThis.window = {
    localStorage: {
      setItem: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    },
  };

  assert.equal(alerts.getTurnAlertsEnabled(), false);
  assert.equal(alerts.rememberTurnAlertsEnabled(true), false);
  assert.equal(alerts.rememberTurnAlertsEnabled(false), false);
});

