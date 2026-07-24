const MANAGEMENT_KEY_PREFIX = "clearandsweet:lobby-management:";

function storageKey(lobbyId: string) {
  return `${MANAGEMENT_KEY_PREFIX}${lobbyId}`;
}

export function rememberLobbyManagementKey(lobbyId: string, manageKey: string) {
  try {
    window.localStorage.setItem(storageKey(lobbyId), manageKey);
    return true;
  } catch {
    return false;
  }
}

export function getLobbyManagementKey(lobbyId: string) {
  try {
    return window.localStorage.getItem(storageKey(lobbyId)) || "";
  } catch {
    return "";
  }
}

export function forgetLobbyManagementKey(lobbyId: string) {
  try {
    window.localStorage.removeItem(storageKey(lobbyId));
  } catch {
    // A failed local cleanup does not change server authorization.
  }
}

export function ownedLobbyIds(lobbyIds: string[]) {
  return new Set(lobbyIds.filter((lobbyId) => Boolean(getLobbyManagementKey(lobbyId))));
}
