import type { LobbyState } from "../api/lobby/logic";

type ReadinessPlayer = Pick<LobbyState["players"][number], "id" | "name">;

type ReadinessState = Pick<
  LobbyState,
  | "players"
  | "readyPlayerIds"
  | "startedAt"
  | "completedAt"
  | "draftActive"
  | "version"
>;

export type DraftReadiness = {
  readyPlayerIds: string[];
  readyCount: number;
  playerCount: number;
  allReady: boolean;
  unreadyPlayers: ReadinessPlayer[];
};

export function normalizeReadyPlayerIds(
  value: unknown,
  players: ReadinessPlayer[]
) {
  const validPlayerIds = new Set(players.map((player) => player.id));
  const normalized = Array.isArray(value)
    ? value.filter(
        (playerId): playerId is string =>
          typeof playerId === "string" && validPlayerIds.has(playerId)
      )
    : [];
  return Array.from(new Set(normalized));
}

export function getDraftReadiness(
  players: ReadinessPlayer[],
  value: unknown
): DraftReadiness {
  const readyPlayerIds = normalizeReadyPlayerIds(value, players);
  const readySet = new Set(readyPlayerIds);
  const unreadyPlayers = players.filter((player) => !readySet.has(player.id));

  return {
    readyPlayerIds,
    readyCount: readyPlayerIds.length,
    playerCount: players.length,
    allReady: players.length > 0 && unreadyPlayers.length === 0,
    unreadyPlayers,
  };
}

export function setLobbyPlayerReady(
  state: ReadinessState,
  playerName: string,
  ready: boolean
): { ok: boolean; error?: string } {
  if (state.startedAt || state.draftActive || state.completedAt) {
    return {
      ok: false,
      error: "Readiness can only change before the draft starts.",
    };
  }

  const normalizedName = playerName.trim().toLowerCase();
  const player = state.players.find(
    (entry) => entry.name.toLowerCase() === normalizedName
  );
  if (!player) {
    return { ok: false, error: "Join the room before marking ready." };
  }

  const currentIds = normalizeReadyPlayerIds(
    state.readyPlayerIds,
    state.players
  );
  const readySet = new Set(currentIds);
  const alreadyReady = readySet.has(player.id);
  if (alreadyReady === ready) {
    state.readyPlayerIds = currentIds;
    return { ok: true };
  }

  if (ready) readySet.add(player.id);
  else readySet.delete(player.id);
  state.readyPlayerIds = Array.from(readySet);
  state.version += 1;
  return { ok: true };
}
