export const STALE_EMPTY_LOBBY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

type LobbyRetentionMeta = {
  status: "active" | "completed";
  createdAt: string;
  updatedAt: string;
  playersCount: number;
  lastPickAt: string | null;
};

export function shouldDeleteStaleEmptyLobby(
  lobby: LobbyRetentionMeta,
  now = Date.now()
) {
  if (
    lobby.status === "completed" ||
    lobby.playersCount > 0 ||
    lobby.lastPickAt
  ) {
    return false;
  }

  const updatedAt = Date.parse(lobby.updatedAt || lobby.createdAt);
  return (
    Number.isFinite(updatedAt) &&
    now - updatedAt > STALE_EMPTY_LOBBY_MAX_AGE_MS
  );
}
