// Pure lobby logic operating on a LobbyState object.
// Copied and adapted from app/api/lobby/store.ts to be id-agnostic and side-effect free
// so it can be reused with different persistence backends (e.g., filesystem).

import { CATEGORY_POOL, DEFAULT_SLOTS } from "./categories";
import { POKEMON_CATEGORY_POOL, POKEMON_DEFAULT_SLOTS } from "../pokemon-categories";
import { getRandomCompetitions } from "./competitions";
import {
  getNextPlayerIndex,
  removeLobbyPlayer,
} from "../../lib/lobbyPlayers";
import { setLobbyPlayerReady } from "../../lib/draftReadiness";
import { rerollLobbyCategory } from "../../lib/draftCategories";
import { getDraftLaunchOrder } from "../../lib/draftOrder";
import {
  matchesDraftUndoExpectation,
  type DraftUndoExpectation,
} from "../../lib/draftUndo";

export type Character = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

export type Player = {
  id: string;
  name: string;
  color: string;
  slots: Record<string, Character | null>;
  popularityTotal: number;
};

export type HistoryEntry = {
  playerIndex: number;
  char: Character;
  slot: string;
  previousRound?: number;
  previousCurrentPlayerIndex?: number;
};

export type DraftPreset = "classic" | "blitz" | "chaos";

export type LobbyState = {
  players: Player[];
  round: number;
  currentPlayerIndex: number;
  timerSeconds: number;
  timerDuration: number;
  preset: DraftPreset;
  lastTickAt: number; // [NEW] Timestamp of last tick to prevent multi-client speedup
  isPaused: boolean; // [NEW] Pause state
  lastPick: null | {
    playerName: string;
    char: Character;
    slot: string;
  };
  history: HistoryEntry[];

  targetPlayers: number; // Deprecated but kept for type compat, effectively unused for limits now
  draftActive: boolean;
  hostName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  draftedIds: number[];
  readyPlayerIds: string[];
  orderShuffled: boolean;
  categoryMode: "default" | "random";
  slotNames: string[];
  version: number;
  competitions: string[];
  draftType: "anime" | "pokemon";
};



const PLAYER_COLORS = [
  "rose",
  "sky",
  "emerald",
  "amber",
  "fuchsia",
  "indigo",
  "lime",
  "cyan",
];

const PRESET_TIMERS: Record<DraftPreset, number> = {
  classic: 300,
  blitz: 60,
  chaos: 90,
};

export function isDraftPreset(value: unknown): value is DraftPreset {
  return value === "classic" || value === "blitz" || value === "chaos";
}

function getPresetSlots(
  draftType: "anime" | "pokemon",
  preset: DraftPreset
): { categoryMode: "default" | "random"; slotNames: string[] } {
  const randomPool = draftType === "pokemon" ? POKEMON_CATEGORY_POOL : CATEGORY_POOL;

  if (preset === "blitz") {
    return {
      categoryMode: "random",
      slotNames: shuffle([...randomPool]).slice(0, 6),
    };
  }

  if (preset === "chaos") {
    return {
      categoryMode: "random",
      slotNames: shuffle([...randomPool]).slice(0, 10),
    };
  }

  return draftType === "pokemon"
    ? {
        categoryMode: "random",
        slotNames: shuffle([...POKEMON_CATEGORY_POOL]).slice(0, 10),
      }
    : { categoryMode: "default", slotNames: [...DEFAULT_SLOTS] };
}

export function makeFreshLobby(
  draftType: "anime" | "pokemon" = "anime",
  preset: DraftPreset = "classic"
): LobbyState {
  const presetSlots = getPresetSlots(draftType, preset);
  const timerDuration = PRESET_TIMERS[preset];

  return {
    players: [],
    round: 1,
    currentPlayerIndex: 0,
    timerSeconds: timerDuration,
    timerDuration,
    preset,
    lastTickAt: Date.now(),
    isPaused: false,
    lastPick: null,
    history: [],
    targetPlayers: 100, // unlimited effectively
    draftActive: false,
    hostName: null,
    startedAt: null,
    completedAt: null,
    draftedIds: [],
    readyPlayerIds: [],
    orderShuffled: false,
    categoryMode: presetSlots.categoryMode,
    slotNames: presetSlots.slotNames,
    version: 0,
    competitions: ["Fight", ...getRandomCompetitions(2)],
    draftType,
  };
}

export function createPlayer(name: string, index: number, slotNames: string[]): Player {
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length] || "rose";
  const slots: Record<string, Character | null> = {};
  for (const slotName of slotNames) slots[slotName] = null;
  return {
    id: `p${index + 1}`,
    name,
    color,
    slots,
    popularityTotal: 0,
  };
}

export function recomputeDraftedIds(state: LobbyState) {
  const all: number[] = [];
  for (const p of state.players) {
    for (const val of Object.values(p.slots)) if (val?.id != null) all.push(val.id);
  }
  state.draftedIds = Array.from(new Set(all));
}

function allSlotsFilled(state: LobbyState): boolean {
  if (!state.players.length) return false;
  return state.players.every((p) => Object.values(p.slots).every((slot) => !!slot));
}

export function isHost(state: LobbyState, name: string | null | undefined): boolean {
  if (!name || !state.hostName) return false;
  return name.trim().toLowerCase() === state.hostName.toLowerCase();
}

export function join(state: LobbyState, name: string): { ok: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required." };

  if (state.draftActive) {
    const already = state.players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (already) return { ok: true };
    return { ok: false, error: "Draft already started." };
  }

  const exists = state.players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) return { ok: true };

  // Removed targetPlayers check to allow variable count
  // if (state.players.length >= state.targetPlayers) { ... }

  const newPlayer = createPlayer(
    trimmed,
    getNextPlayerIndex(state.players),
    state.slotNames
  );
  state.players.push(newPlayer);
  state.orderShuffled = false;
  if (!state.hostName) state.hostName = trimmed;
  state.version += 1;
  return { ok: true };
}

export function removePlayer(
  state: LobbyState,
  requesterName: string,
  playerId: string
): { ok: boolean; error?: string; removedName?: string } {
  const result = removeLobbyPlayer(state, requesterName, playerId);
  if (result.ok) state.orderShuffled = false;
  return result;
}

export function setPlayerReady(
  state: LobbyState,
  playerName: string,
  ready: boolean
): { ok: boolean; error?: string } {
  return setLobbyPlayerReady(state, playerName, ready);
}

export function setCategoryMode(state: LobbyState, requesterName: string, mode: "default" | "random") {
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can change settings." };
  if (state.startedAt || state.draftActive || state.completedAt) {
    return { ok: false, error: "Categories can only change before the draft starts." };
  }
  if (mode !== "default" && mode !== "random") {
    return { ok: false, error: "Invalid category mode." };
  }

  state.categoryMode = mode;

  const isPokemon = state.draftType === "pokemon";

  const slotCount = state.preset === "blitz" ? 6 : 10;

  if (mode === "default") {
    const defaultSlots = isPokemon ? POKEMON_DEFAULT_SLOTS : DEFAULT_SLOTS;
    state.slotNames = [...defaultSlots].slice(0, slotCount);
  } else {
    const pool = isPokemon ? POKEMON_CATEGORY_POOL : CATEGORY_POOL;
    state.slotNames = shuffle([...pool]).slice(0, slotCount);
  }

  // Update existing players to have these new slots
  // Since draft hasn't started, all slots are empty anyway.
  for (const p of state.players) {
    const newSlots: Record<string, Character | null> = {};
    for (const s of state.slotNames) {
      newSlots[s] = null;
    }
    p.slots = newSlots;
  }
  state.version += 1;
  return { ok: true };
}

export function rerollCategory(
  state: LobbyState,
  requesterName: string,
  slotName: string
) {
  const categoryPool =
    state.draftType === "pokemon" ? POKEMON_CATEGORY_POOL : CATEGORY_POOL;
  return rerollLobbyCategory(
    state,
    requesterName,
    slotName,
    categoryPool
  );
}

export function setTarget(state: LobbyState, requesterName: string, newTarget: number) {
  // No-op or deprecated, we just allow it to return ok to not break existing clients immediately
  // but we don't enforce limits anymore.
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can change draft size." };
  state.targetPlayers = newTarget;
  state.version += 1;
  return { ok: true };
}

export function start(state: LobbyState, requesterName: string) {
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can start the draft." };
  if (state.draftActive) return { ok: false, error: "Draft already started." };
  if (state.players.length < 1)
    return { ok: false, error: "Need at least 1 player to start." };

  state.players = getDraftLaunchOrder(state.players, state.orderShuffled);
  state.orderShuffled = true;
  state.round = 1;
  state.currentPlayerIndex = 0;
  state.timerSeconds = state.timerDuration;
  state.lastTickAt = Date.now(); // [NEW]
  state.isPaused = false;
  state.draftActive = true;
  state.startedAt = new Date().toISOString();
  state.completedAt = null;
  recomputeDraftedIds(state);
  state.version += 1;
  return { ok: true };
}

export function pick(
  state: LobbyState,
  args: { actingName: string; slotName: string; chosen: Character }
) {
  if (!state.draftActive) return { ok: false, error: "Draft has not started." };
  if (state.isPaused) return { ok: false, error: "Draft is paused." };
  const { actingName, slotName, chosen } = args;
  const actingLower = actingName.trim().toLowerCase();
  const curIndex = state.currentPlayerIndex;
  const roundBeforePick = state.round;
  const drafter = state.players[curIndex];
  if (!drafter || drafter.name.toLowerCase() !== actingLower)
    return { ok: false, error: "It's not your turn." };
  if (!(slotName in drafter.slots)) return { ok: false, error: "Invalid slot." };
  if (drafter.slots[slotName]) return { ok: false, error: "That slot is already filled." };
  if (state.draftedIds.includes(chosen.id)) return { ok: false, error: "That character is already taken." };

  drafter.slots[slotName] = chosen;
  drafter.popularityTotal += chosen.favourites || 0;
  state.lastPick = { playerName: drafter.name, char: chosen, slot: slotName };
  state.history.push({
    playerIndex: curIndex,
    char: chosen,
    slot: slotName,
    previousRound: roundBeforePick,
    previousCurrentPlayerIndex: curIndex,
  });
  if (!state.draftedIds.includes(chosen.id)) state.draftedIds.push(chosen.id);
  if (allSlotsFilled(state)) {
    state.draftActive = false;
    state.timerSeconds = 0;
    state.currentPlayerIndex = 0;
  } else {
    advanceSnakeTurn(state);
  }
  state.version += 1;
  return { ok: true };
}

export function undo(
  state: LobbyState,
  requesterName: string,
  expectation?: DraftUndoExpectation
) {
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can undo." };
  if (!state.history.length) return { ok: false, error: "Nothing to undo." };
  if (
    expectation &&
    !matchesDraftUndoExpectation(state.history, expectation)
  ) {
    return {
      ok: false,
      error:
        "The draft changed before the undo was confirmed. Review the latest pick and try again.",
    };
  }
  const last = state.history.pop()!;
  const { playerIndex, char, slot } = last;
  const pl = state.players[playerIndex];
  if (pl && pl.slots[slot] && pl.slots[slot]?.id === char.id) {
    pl.slots[slot] = null;
    pl.popularityTotal = Math.max(0, pl.popularityTotal - (char.favourites || 0));
  }
  state.lastPick = null;
  const roundBefore = last.previousRound ?? state.round;
  const indexBefore = last.previousCurrentPlayerIndex ?? playerIndex;
  state.round = roundBefore;
  rewindSnakeTurnTo(state, indexBefore);
  state.draftActive = true;
  state.isPaused = false; // Unpause on undo just in case
  state.completedAt = null;
  recomputeDraftedIds(state);
  state.version += 1;
  return { ok: true };
}

export function togglePause(state: LobbyState, requesterName: string) {
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can pause/resume." };
  if (!state.draftActive) return { ok: false, error: "Draft not active." };

  state.isPaused = !state.isPaused;
  // If resuming, reset lastTickAt so we don't jump ahead
  if (!state.isPaused) {
    state.lastTickAt = Date.now();
  }
  state.version += 1;
  return { ok: true, isPaused: state.isPaused };
}

export function tick(state: LobbyState) {
  if (!state.draftActive) return;
  if (state.isPaused) return; // Do not tick if paused

  const now = Date.now();
  // Initialize lastTickAt if missing (migration)
  if (!state.lastTickAt) state.lastTickAt = now;

  const deltaMs = now - state.lastTickAt;
  if (deltaMs < 1000) return; // Not enough time passed

  const secondsPassed = Math.floor(deltaMs / 1000);

  // Only tick if at least 1 second passed
  if (secondsPassed >= 1) {
    state.timerSeconds -= secondsPassed;
    // Advance lastTickAt by the exact seconds consumed to keep alignment, 
    // or just set to now. Setting to now is safer against drift if we process slowly.
    // But setting to (lastTickAt + secondsPassed * 1000) is more precise.
    // Let's just set to now to be robust against clock jumps.
    state.lastTickAt = now;
  }

  if (state.timerSeconds <= 0) {
    state.timerSeconds = 0;
    doAutopick(state);
  }
}

export function isRoundForward(r: number) {
  return r % 2 === 1; // odd rounds go forward
}

export function advanceSnakeTurn(state: LobbyState) {
  state.timerSeconds = state.timerDuration;
  state.lastTickAt = Date.now(); // [NEW]
  const n = state.players.length;
  const forward = isRoundForward(state.round);
  const atEndForward = forward && state.currentPlayerIndex === n - 1;
  const atEndBackward = !forward && state.currentPlayerIndex === 0;
  if (atEndForward || atEndBackward) {
    state.round += 1;
    state.currentPlayerIndex = forward ? n - 1 : 0;
  } else {
    state.currentPlayerIndex = forward ? state.currentPlayerIndex + 1 : state.currentPlayerIndex - 1;
  }
}

export function rewindSnakeTurnTo(state: LobbyState, playerIndex: number) {
  state.currentPlayerIndex = playerIndex;
  state.timerSeconds = state.timerDuration;
  state.lastTickAt = Date.now(); // [NEW]
}

export function doAutopick(state: LobbyState) {
  if (!state.draftActive) return;
  const roundBefore = state.round;
  const indexBefore = state.currentPlayerIndex;
  state.lastPick = null;
  if (allSlotsFilled(state)) {
    state.draftActive = false;
    state.timerSeconds = 0;
    state.currentPlayerIndex = 0;
    return;
  }
  advanceSnakeTurn(state);
  // advanceSnakeTurn resets the timer for the selected preset.
  state.history.push({
    playerIndex: indexBefore,
    char: {
      id: -1,
      name: { full: "Turn Skipped", native: "" },
      gender: "",
      image: { large: "" },
      favourites: 0,
    },
    slot: "AUTO_SKIP",
    previousRound: roundBefore,
    previousCurrentPlayerIndex: indexBefore,
  });
  state.version += 1;
}

export function finishDraft(state: LobbyState, requesterName: string) {
  if (!isHost(state, requesterName))
    return { ok: false, error: "Only host can finish the draft." };
  if (!allSlotsFilled(state))
    return { ok: false, error: "Draft still has open slots." };
  state.draftActive = false;
  state.completedAt = new Date().toISOString();
  state.timerSeconds = 0;
  state.currentPlayerIndex = 0;
  state.version += 1;
  return { ok: true };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
