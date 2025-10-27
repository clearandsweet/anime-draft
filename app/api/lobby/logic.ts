// Pure lobby logic operating on a LobbyState object.
// Copied and adapted from app/api/lobby/store.ts to be id-agnostic and side-effect free
// so it can be reused with different persistence backends (e.g., filesystem).

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
  draftedIds: number[];
};

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

export function makeFreshLobby(): LobbyState {
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

export function createPlayer(name: string, index: number): Player {
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length] || "rose";
  const slots: Record<string, Character | null> = {};
  for (const slotName of SLOT_NAMES) slots[slotName] = null;
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

  if (state.players.length >= state.targetPlayers) {
    return { ok: false, error: "Lobby is already full." };
  }

  const newPlayer = createPlayer(trimmed, state.players.length);
  state.players.push(newPlayer);
  if (!state.hostName) state.hostName = trimmed;
  return { ok: true };
}

export function setTarget(state: LobbyState, requesterName: string, newTarget: number) {
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can change draft size." };
  if (state.draftActive) return { ok: false, error: "Draft already started." };
  if (![2, 4, 8, 12].includes(newTarget)) return { ok: false, error: "Invalid target size." };
  if (newTarget < state.players.length)
    return { ok: false, error: "Too few slots: players already joined more than that." };
  state.targetPlayers = newTarget;
  return { ok: true };
}

export function start(state: LobbyState, requesterName: string) {
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can start the draft." };
  if (state.draftActive) return { ok: false, error: "Draft already started." };
  if (state.players.length !== state.targetPlayers || state.players.length < 2)
    return { ok: false, error: "Lobby isn't full yet (or too small)." };

  state.players = shuffle(state.players);
  state.round = 1;
  state.currentPlayerIndex = 0;
  state.timerSeconds = 180;
  state.draftActive = true;
  state.startedAt = new Date().toISOString();
  state.completedAt = null;
  recomputeDraftedIds(state);
  return { ok: true };
}

export function pick(
  state: LobbyState,
  args: { actingName: string; slotName: string; chosen: Character }
) {
  if (!state.draftActive) return { ok: false, error: "Draft has not started." };
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
    state.completedAt = new Date().toISOString();
    state.timerSeconds = 0;
    state.currentPlayerIndex = 0;
  } else {
    advanceSnakeTurn(state);
  }
  return { ok: true };
}

export function undo(state: LobbyState, requesterName: string) {
  if (!isHost(state, requesterName)) return { ok: false, error: "Only host can undo." };
  if (!state.history.length) return { ok: false, error: "Nothing to undo." };
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
  state.completedAt = null;
  recomputeDraftedIds(state);
  return { ok: true };
}

export function tick(state: LobbyState) {
  if (!state.draftActive) return;
  if (state.timerSeconds > 0) state.timerSeconds -= 1;
  if (state.timerSeconds <= 0) doAutopick(state);
}

export function isRoundForward(r: number) {
  return r % 2 === 1; // odd rounds go forward
}

export function advanceSnakeTurn(state: LobbyState) {
  state.timerSeconds = 180;
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
  state.timerSeconds = 180;
}

export function doAutopick(state: LobbyState) {
  // placeholder: just reset timer so draft doesn't freeze
  state.timerSeconds = 180;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
