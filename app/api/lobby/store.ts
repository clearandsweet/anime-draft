// app/api/lobby/store.ts

// Types reused server-side
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
};

// slot list (MUST match client)
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

// fixed color cycle, same as client but we just keep text values
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

// initial (empty) lobby
let lobby: LobbyState = {
  players: [],
  round: 1,
  currentPlayerIndex: 0,
  timerSeconds: 180,
  lastPick: null,
  history: [],
};

// helper: find or create player slot
function addPlayerIfMissing(name: string): LobbyState {
  // does this name already exist?
  const existingIdx = lobby.players.findIndex(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (existingIdx !== -1) {
    return lobby; // already in
  }

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

  return lobby;
}

// helper: snake draft turn advance
function advanceTurn() {
  lobby.timerSeconds = 180;

  const odd = lobby.round % 2 === 1; // odd -> forward, even -> backward
  const i = lobby.currentPlayerIndex;

  const atEndFwd = odd && i === lobby.players.length - 1;
  const atEndBwd = !odd && i === 0;

  if (atEndFwd || atEndBwd) {
    // new round
    lobby.round += 1;
    lobby.currentPlayerIndex = odd
      ? lobby.players.length - 1
      : 0;
  } else {
    lobby.currentPlayerIndex = odd ? i + 1 : i - 1;
  }
}

// main draft action (server-authoritative)
function draftCharacter(params: {
  actingName: string;     // who is trying
  chosen: Character;      // character data (full object from client)
  slotName: string;       // which slot to fill
}) {
  const { actingName, chosen, slotName } = params;

  // sanity checks
  if (!lobby.players.length) {
    throw new Error("No players in lobby");
  }

  const turnPlayer = lobby.players[lobby.currentPlayerIndex];
  if (
    turnPlayer.name.toLowerCase() !== actingName.toLowerCase()
  ) {
    throw new Error("Not your turn");
  }

  // make sure that slot is open on that player
  if (turnPlayer.slots[slotName]) {
    throw new Error("Slot already filled");
  }

  // assign char
  turnPlayer.slots[slotName] = chosen;
  turnPlayer.popularityTotal += chosen.favourites || 0;

  // log history
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

  // next turn
  advanceTurn();
}

// undo the last pick (simple global undo)
function undoLast() {
  if (!lobby.history.length) return;

  const last = lobby.history[lobby.history.length - 1];
  const { playerIndex, char, slot } = last;
  const pl = lobby.players[playerIndex];
  if (!pl) return;

  // remove char from slot, refund score
  pl.slots[slot] = null;
  pl.popularityTotal = Math.max(
    0,
    pl.popularityTotal - (char.favourites || 0)
  );

  // reset lastPick
  lobby.lastPick = null;

  // give turn back to that drafter
  lobby.currentPlayerIndex = playerIndex;
  // do NOT rewind round for now; that's fine for v1
  lobby.timerSeconds = 180;

  // pop history
  lobby.history.pop();
}

// tick timer down 1 second; if hits 0, autopick
// autopick = do nothing for v1, just reset timer + advance turn.
// (We'll upgrade later.)
function tickTimer() {
  if (!lobby.players.length) return;
  if (lobby.timerSeconds > 0) {
    lobby.timerSeconds -= 1;
    return;
  }
  // timer hit 0 -> skip their turn for now
  lobby.timerSeconds = 180;
  advanceTurn();
}

export const LobbyStore = {
  getLobby() {
    return lobby;
  },
  join(name: string) {
    addPlayerIfMissing(name);
    // if this is the very first player, currentPlayerIndex stays 0,
    // which means round/turn starts with them
    return lobby;
  },
  pick(params: {
    actingName: string;
    slotName: string;
    chosen: Character;
  }) {
    draftCharacter(params);
    return lobby;
  },
  undo() {
    undoLast();
    return lobby;
  },
  tick() {
    tickTimer();
    return lobby;
  },
  reset() {
    lobby = {
      players: [],
      round: 1,
      currentPlayerIndex: 0,
      timerSeconds: 180,
      lastPick: null,
      history: [],
    };
    return lobby;
  },
};
