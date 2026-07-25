export type DraftTurnAlertType = "anime" | "pokemon";

const TURN_ALERTS_STORAGE_KEY = "clearandsweet:draft-turn-alerts";

type ShouldAnnounceTurnInput = {
  enabled: boolean;
  draftActive: boolean;
  isPaused: boolean;
  viewerName: string;
  currentPlayerName: string;
  previousTurnKey: string;
  currentTurnKey: string;
};

export function getDraftTurnKey(
  round: number,
  currentPlayerId: string,
  completedTurnCount: number
) {
  return `${Math.max(0, Math.floor(round))}:${currentPlayerId}:${Math.max(
    0,
    Math.floor(completedTurnCount)
  )}`;
}

export function shouldAnnounceDraftTurn({
  enabled,
  draftActive,
  isPaused,
  viewerName,
  currentPlayerName,
  previousTurnKey,
  currentTurnKey,
}: ShouldAnnounceTurnInput) {
  if (!enabled || !draftActive || isPaused) return false;
  if (!currentTurnKey || currentTurnKey === previousTurnKey) return false;
  const viewer = viewerName.trim().toLowerCase();
  const current = currentPlayerName.trim().toLowerCase();
  return Boolean(viewer && current && viewer === current);
}

export function getDraftTurnAlertBody(
  draftType: DraftTurnAlertType,
  lobbyId: string,
  playerName: string
) {
  const draftLabel = draftType === "pokemon" ? "Pokémon Draft" : "Anime Draft";
  const normalizedName = playerName.trim() || "Player";
  return `${normalizedName}, it is your turn in ${draftLabel} #${lobbyId}.`;
}

export function getTurnAlertsEnabled() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(TURN_ALERTS_STORAGE_KEY) === "enabled";
  } catch {
    return false;
  }
}

export function rememberTurnAlertsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return false;

  try {
    if (enabled) {
      window.localStorage.setItem(TURN_ALERTS_STORAGE_KEY, "enabled");
    } else {
      window.localStorage.removeItem(TURN_ALERTS_STORAGE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

