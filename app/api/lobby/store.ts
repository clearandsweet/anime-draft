// app/api/lobby/store.ts

export type Character = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

export type Player = {
  id: string; // "p1", "p2", ...
  name: string;
  color: string;
  slots: Record<string, Character | null>;
  popularityTotal: number;
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
  history: { playerIndex: number; char: Character; slot: string }[];

  targetPlayers: number; // 2 / 4 / 8 / 12
  draftActive: boolean; // false until Start Draft
  hostName: string | null; // person with control
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

let lobby: LobbyState = {
  players: [],
  round: 1,
  currentPlayerIndex: 0,
  timerSeconds: 180,
  lastPick: null,
  history: [],

  targetPlayers: 4,
  draftActive: false,
  hostName: null,
};

// internal helpers

function advanceTurn() {
  lobby.timerSeconds = 180;

  const odd = lobby.round % 2 === 1; // odd -> forward, even -> backward
  const i = lobby.currentPlayerIndex;

  const atEndFwd = odd && i === lobby.players.length - 1;
  const atEndBwd = !odd && i === 0;

  if (atEndFwd || atEndBwd) {
    lobby.round += 1;
    lobby.currentPlayerIndex = odd
      ? lobby.players.length - 1
      : 0;
  } else {
    lobby.currentPlayerIndex = odd ? i + 1 : i - 1;
  }
}

function addPlayerIfMissing(name: string): void {
  const already = lobby.players.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (already) return;

  const newIndex = lobby.players.length;
  const color = PLAYER_COLORS[newIndex % PLAYER_COLORS.length];

  const newPlayer: Player = {
    id: `p${newIndex + 1}`,
    name,
    color,
    slots: Object.fromEntries(SLOT_NAMES.map((s) => [s, null])) as Record<
      string,
      Character | null
    >,
    popularityTotal: 0,
  };

  lobby.players.push(newPlayer);

  // if we don't have a host yet, first joiner becomes host
  if (!lobby.hostName) {
    lobby.hostName = name;
  }
}

function draftCharacter(params: {
  actingName: string;
  chosen: Character;
  slotName: string;
}) {
  const { actingName, chosen, slotName } = params;

  if (!lobby.draftActive) {
    throw new Error("Draft has not started");
  }

  if (!lobby.players.length) {
    throw new Error("No players in lobby");
  }

  const turnPlayer = lobby.players[lobby.currentPlayerIndex];
  if (
    turnPlayer.name.toLowerCase() !== actingName.toLowerCase()
  ) {
    throw new Error("Not your turn");
  }

  if (turnPlayer.slots[slotName]) {
    throw new Error("Slot already filled");
  }

  // fill
  turnPlayer.slots[slotName] = chosen;
  turnPlayer.popularityTotal += chosen.favourites || 0;

  lobby.lastPick = {
    playerName: turnPlayer.name,
    char: chosen,
    slot: slotName,
  };

  lobby.history.push({
    playerIndex: lobby.currentPlayerIndex,
    char: chosen,
    slot: slotName,
  });

  advanceTurn();
}

function undoLast(actingName: string) {
  // host only
  if (!lobby.hostName) return;
  if (
    actingName.toLowerCase() !== lobby.hostName.toLowerCase()
  ) {
    throw new Error("Only host can undo");
  }

  if (!lobby.history.length) return;

  const last = lobby.history[lobby.history.length - 1];
  const { playerIndex, char, slot } = last;
  const pl = lobby.players[playerIndex];
  if (!pl) return;

  pl.slots[slot] = null;
  pl.popularityTotal = Math.max(
    0,
    pl.popularityTotal - (char.favourites || 0)
  );

  lobby.lastPick = null;

  lobby.currentPlayerIndex = playerIndex;
  lobby.timerSeconds = 180;

  lobby.history.pop();
}

function tickTimer() {
  if (!lobby.draftActive) {
    return; // don't tick in pregame
  }
  if (!lobby.players.length) return;

  if (lobby.timerSeconds > 0) {
    lobby.timerSeconds -= 1;
    return;
  }

  // timeout: skip turn (no forced autopick yet)
  lobby.timerSeconds = 180;
  advanceTurn();
}

function setTargetPlayersCount(n: number, actingName: string) {
  // only host can adjust
  if (!lobby.hostName) return;
  if (
    actingName.toLowerCase() !== lobby.hostName.toLowerCase()
  ) {
    // non-host can't change it
    return;
  }
  if (![2, 4, 8, 12].includes(n)) return;
  if (lobby.draftActive) return;
  lobby.targetPlayers = n;
}

function startDraftNow(actingName: string) {
  // only host can start
  if (!lobby.hostName) {
    throw new Error("No host yet");
  }
  if (
    actingName.toLowerCase() !== lobby.hostName.toLowerCase()
  ) {
    throw new Error("Only host can start");
  }

  const joined = lobby.players.length;
  if (
    joined !== lobby.targetPlayers ||
    joined < 2
  ) {
    throw new Error("Not enough players joined yet");
  }

  lobby.draftActive = true;

  // fresh snake start
  lobby.round = 1;
  lobby.currentPlayerIndex = 0;
  lobby.timerSeconds = 180;
  lobby.lastPick = null;
  lobby.history = [];
}

function resetLobby() {
  lobby = {
    players: [],
    round: 1,
    currentPlayerIndex: 0,
    timerSeconds: 180,
    lastPick: null,
    history: [],

    targetPlayers: 4,
    draftActive: false,
    hostName: null,
  };
}

// Export API
export const LobbyStore = {
  getLobby() {
    return lobby;
  },
  join(name: string) {
    addPlayerIfMissing(name);
    return lobby;
  },
  pick(params: { actingName: string; slotName: string; chosen: Character }) {
    draftCharacter(params);
    return lobby;
  },
  undo(actingName: string) {
    undoLast(actingName);
    return lobby;
  },
  tick() {
    tickTimer();
    return lobby;
  },
  setTargetPlayers(n: number, actingName: string) {
    setTargetPlayersCount(n, actingName);
    return lobby;
  },
  startDraft(actingName: string) {
    startDraftNow(actingName);
    return lobby;
  },
  reset() {
    resetLobby();
    return lobby;
  },
};
