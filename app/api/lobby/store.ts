// app/api/lobby/store.ts

// Types we share with the client
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

export type LobbyState = {
  players: Player[];
  round: number;
  currentPlayerIndex: number;
  timerSeconds: number;
  lastPick: null | {
    playerName: string;
    char: Character;
    slot: string;
  };
  history: HistoryEntry[];
  targetPlayers: number;
  draftActive: boolean;
  hostName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  draftedIds: number[]; // NEW
};

// slot layout we give each new player
const SLOT_NAMES = [
  "Waifu",
  "Husbando",
  "Not Human",
  "Not Alive or Artifical",
  "Old",
  "Minor Character",
  "Evil",
  "Child",
  "Comic Relief",
  "Wildcard",
];

// colors we rotate through when people join
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

// internal mutable singleton lobby
const lobby: LobbyState = makeFreshLobby();

function makeFreshLobby(): LobbyState {
  return {
    players: [],
    round: 1,
    currentPlayerIndex: 0,
    timerSeconds: 180,
    lastPick: null,
    history: [],
    targetPlayers: 4,
    draftActive: false,
    hostName: null,
    startedAt: null,
    completedAt: null,
    draftedIds: [],
  };
}

// helper: create player struct
function createPlayer(name: string, index: number): Player {
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length] || "rose";

  // build empty slots
  const slots: Record<string, Character | null> = {};
  for (const slotName of SLOT_NAMES) {
    slots[slotName] = null;
  }

  return {
    id: `p${index + 1}`,
    name,
    color,
    slots,
    popularityTotal: 0,
  };
}

// recompute draftedIds from the current board
function recomputeDraftedIds() {
  const all: number[] = [];
  for (const p of lobby.players) {
    for (const val of Object.values(p.slots)) {
      if (val && val.id != null) {
        all.push(val.id);
      }
    }
  }
  lobby.draftedIds = Array.from(new Set(all));
}

function allSlotsFilledInLobby(): boolean {
  if (!lobby.players.length) return false;
  return lobby.players.every((p) => Object.values(p.slots).every((slot) => !!slot));
}

// ------ exposed helpers for routes ------

// GET state
export function getLobby(): LobbyState {
  return lobby;
}

// POST /join
export function joinLobby(name: string): { ok: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Name required." };
  }
  if (lobby.draftActive) {
    // lock seats after draft starts
    const already = lobby.players.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (already) {
      // reconnect, allowed
      return { ok: true };
    }
    return { ok: false, error: "Draft already started." };
  }

  const exists = lobby.players.find(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) {
    return { ok: true }; // they already joined
  }

  if (lobby.players.length >= lobby.targetPlayers) {
    return { ok: false, error: "Lobby is already full." };
  }

  // create the new player
  const newPlayer = createPlayer(trimmed, lobby.players.length);
  lobby.players.push(newPlayer);

  // first joiner becomes host
  if (!lobby.hostName) {
    lobby.hostName = trimmed;
  }

  return { ok: true };
}

// POST /target (host only)
export function setTargetPlayerCount(
  requesterName: string,
  newTarget: number
): { ok: boolean; error?: string } {
  if (!isHost(requesterName)) {
    return { ok: false, error: "Only host can change draft size." };
  }
  if (lobby.draftActive) {
    return { ok: false, error: "Draft already started." };
  }
  if (![2, 4, 8, 12].includes(newTarget)) {
    return { ok: false, error: "Invalid target size." };
  }
  if (newTarget < lobby.players.length) {
    return {
      ok: false,
      error: "Too few slots: players already joined more than that.",
    };
  }

  lobby.targetPlayers = newTarget;
  return { ok: true };
}

// POST /start (host only)
export function startDraft(requesterName: string): {
  ok: boolean;
  error?: string;
} {
  if (!isHost(requesterName)) {
    return { ok: false, error: "Only host can start the draft." };
  }
  if (lobby.draftActive) {
    return { ok: false, error: "Draft already started." };
  }

  if (
    lobby.players.length !== lobby.targetPlayers ||
    lobby.players.length < 2
  ) {
    return {
      ok: false,
      error: "Lobby isn't full yet (or too small).",
    };
  }

  // shuffle players for fairness
  lobby.players = shuffle(lobby.players);

  // reset turn/round info now that order may have changed
  lobby.round = 1;
  lobby.currentPlayerIndex = 0;
  lobby.timerSeconds = 180;
  lobby.draftActive = true;

  // also wipe any leftover picks if we somehow restarted after testing
  recomputeDraftedIds();

  return { ok: true };
}

// POST /pick  -> confirmSlot() in client
export function draftPick(args: {
  actingName: string;
  slotName: string;
  chosen: Character;
}): { ok: boolean; error?: string } {
  if (!lobby.draftActive) {
    return { ok: false, error: "Draft has not started." };
  }

  const { actingName, slotName, chosen } = args;
  const actingLower = actingName.trim().toLowerCase();

  // must be that player's turn
  const curIndex = lobby.currentPlayerIndex;
  const drafter = lobby.players[curIndex];
  if (!drafter || drafter.name.toLowerCase() !== actingLower) {
    return { ok: false, error: "It's not your turn." };
  }

  // slot must exist and be empty
  if (!(slotName in drafter.slots)) {
    return { ok: false, error: "Invalid slot." };
  }
  if (drafter.slots[slotName]) {
    return { ok: false, error: "That slot is already filled." };
  }

  // character can't be already drafted
  if (lobby.draftedIds.includes(chosen.id)) {
    return { ok: false, error: "That character is already taken." };
  }

  // assign character to that slot
  drafter.slots[slotName] = chosen;
  drafter.popularityTotal += chosen.favourites || 0;

  // update lastPick + history
  lobby.lastPick = {
    playerName: drafter.name,
    char: chosen,
    slot: slotName,
  };
  lobby.history.push({
    playerIndex: curIndex,
    char: chosen,
    slot: slotName,
    previousRound: lobby.round,
    previousCurrentPlayerIndex: curIndex,
  });

  // mark drafted
  if (!lobby.draftedIds.includes(chosen.id)) {
    lobby.draftedIds.push(chosen.id);
  }

  if (allSlotsFilledInLobby()) {
    lobby.draftActive = false;
    lobby.completedAt = new Date().toISOString();
    lobby.timerSeconds = 0;
    lobby.currentPlayerIndex = 0;
  } else {
    advanceSnakeTurn();
  }

  return { ok: true };
}

// POST /undo  (host only)
export function undoLastPick(requesterName: string): {
  ok: boolean;
  error?: string;
} {
  if (!isHost(requesterName)) {
    return { ok: false, error: "Only host can undo." };
  }

  if (!lobby.history.length) {
    return { ok: false, error: "Nothing to undo." };
  }

  const last = lobby.history.pop()!;
  const { playerIndex, char, slot } = last;

  // remove char from that slot
  const pl = lobby.players[playerIndex];
  if (pl && pl.slots[slot] && pl.slots[slot]?.id === char.id) {
    pl.slots[slot] = null;
    pl.popularityTotal = Math.max(
      0,
      pl.popularityTotal - (char.favourites || 0)
    );
  }

  // fix lastPick (it's no longer valid)
  lobby.lastPick = null;

  // reverse one step of turn logic:
  // we want to rewind currentPlayerIndex / round / timer so the undone picker's turn is restored
  const roundBefore = last.previousRound ?? lobby.round;
  const indexBefore = last.previousCurrentPlayerIndex ?? playerIndex;
  lobby.round = roundBefore;
  rewindSnakeTurnTo(indexBefore);
  lobby.draftActive = true;
  lobby.completedAt = null;

  // recompute draftedIds from board so that character comes back
  recomputeDraftedIds();

  return { ok: true };
}

// expose tick logic for a 1s interval in /state polling
// this decreases timerSeconds and autopicks if it hits 0
export function tickTimerAndMaybeAutopick() {
  if (!lobby.draftActive) return;

  // count down
  if (lobby.timerSeconds > 0) {
    lobby.timerSeconds -= 1;
  }

  // hit zero => autopick best available in first empty slot
  if (lobby.timerSeconds <= 0) {
    doAutopickForCurrentPlayer();
  }
}

// ---------- snake draft helpers ----------

// snake order logic:
// round 1: 0 -> 1 -> 2 -> ... -> n-1
// round 2: n-1 -> n-2 -> ... -> 0
// round 3: 0 -> 1 -> ...
// etc.
function isRoundForward(r: number) {
  return r % 2 === 1; // odd rounds go forward
}

function advanceSnakeTurn() {
  lobby.timerSeconds = 180;

  const n = lobby.players.length;
  const forward = isRoundForward(lobby.round);

  const atEndForward = forward && lobby.currentPlayerIndex === n - 1;
  const atEndBackward = !forward && lobby.currentPlayerIndex === 0;

  if (atEndForward || atEndBackward) {
    // advance round and "bounce"
    lobby.round += 1;
    lobby.currentPlayerIndex = forward ? n - 1 : 0;
  } else {
    lobby.currentPlayerIndex = forward
      ? lobby.currentPlayerIndex + 1
      : lobby.currentPlayerIndex - 1;
  }
}

// rewind to a specific player index (used in undo)
function rewindSnakeTurnTo(playerIndex: number) {
  lobby.currentPlayerIndex = playerIndex;
  // do not rewind round number. keeping round simple
  lobby.timerSeconds = 180;
}

// autopick: choose best remaining character for current player
// NOTE: we don't know the giant AniList pool here on the server.
// for now we'll just skip autopick logic. In future we could accept
// "topAvailableCharacter" from client or persist server-side pool.
// For safety we just reset timer so draft doesn't freeze.
function doAutopickForCurrentPlayer() {
  // no-op autopick placeholder
  lobby.timerSeconds = 180;
}

// general helpers
function isHost(name: string | null | undefined): boolean {
  if (!name || !lobby.hostName) return false;
  return name.trim().toLowerCase() === lobby.hostName.toLowerCase();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}




