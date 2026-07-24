import type { LobbyState } from "../api/lobby/logic";

type PlayerManagementState = Pick<
  LobbyState,
  | "players"
  | "hostName"
  | "startedAt"
  | "completedAt"
  | "draftActive"
  | "readyPlayerIds"
  | "version"
>;

export type RemoveLobbyPlayerResult = {
  ok: boolean;
  error?: string;
  removedName?: string;
};

export function getNextPlayerIndex(players: Array<{ id: string }>) {
  const usedIds = new Set(players.map((player) => player.id));
  let index = 0;
  while (usedIds.has(`p${index + 1}`)) index += 1;
  return index;
}

export function removeLobbyPlayer(
  state: PlayerManagementState,
  requesterName: string,
  playerId: string
): RemoveLobbyPlayerResult {
  const requesterIsHost =
    Boolean(state.hostName) &&
    requesterName.trim().toLowerCase() === state.hostName?.toLowerCase();
  if (!requesterIsHost) {
    return { ok: false, error: "Only the host can remove players." };
  }
  if (state.startedAt || state.draftActive || state.completedAt) {
    return {
      ok: false,
      error: "Players can only be removed before the draft starts.",
    };
  }

  const targetIndex = state.players.findIndex(
    (player) => player.id === playerId.trim()
  );
  if (targetIndex < 0) {
    return { ok: false, error: "That player is no longer in the room." };
  }

  const target = state.players[targetIndex];
  if (
    state.hostName &&
    target.name.toLowerCase() === state.hostName.toLowerCase()
  ) {
    return {
      ok: false,
      error: "The host cannot remove themselves from the room.",
    };
  }

  state.players.splice(targetIndex, 1);
  state.readyPlayerIds = (state.readyPlayerIds ?? []).filter(
    (playerId) => playerId !== target.id
  );
  state.version += 1;
  return { ok: true, removedName: target.name };
}
