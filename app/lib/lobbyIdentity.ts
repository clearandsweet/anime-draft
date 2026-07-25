const IDENTITY_KEY_PREFIX = "clearandsweet:lobby-identity:";

function storageKey(lobbyId: string) {
  return `${IDENTITY_KEY_PREFIX}${lobbyId}`;
}

export function rememberLobbyIdentity(lobbyId: string, playerName: string) {
  if (typeof window === "undefined") return false;

  const normalizedName = playerName.trim();
  if (!normalizedName) return false;

  try {
    window.localStorage.setItem(storageKey(lobbyId), normalizedName);
    return true;
  } catch {
    return false;
  }
}

export function getLobbyIdentity(lobbyId: string) {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(storageKey(lobbyId))?.trim() || "";
  } catch {
    return "";
  }
}

export function rememberedLobbyIds(lobbyIds: string[]) {
  return new Set(
    lobbyIds.filter((lobbyId) => Boolean(getLobbyIdentity(lobbyId)))
  );
}

export function forgetLobbyIdentity(lobbyId: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey(lobbyId));
  } catch {
    // The in-memory identity can still be cleared if storage is unavailable.
  }
}
