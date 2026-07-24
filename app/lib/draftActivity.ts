import type { HistoryEntry, LobbyState } from "../api/lobby/logic";

export type DraftActivityEvent = {
  eventNumber: number;
  pickNumber: number | null;
  isSkip: boolean;
  playerName: string;
  playerColor: string | null;
  characterName: string;
  imageUrl: string;
  slot: string;
  round: number | null;
};

type ActivityLobby = Pick<LobbyState, "history" | "players">;

export function isSkippedDraftTurn(entry: HistoryEntry) {
  return entry.slot === "AUTO_SKIP" || entry.char.id === -1;
}

export function getCompletedPickCount(history: HistoryEntry[] | undefined) {
  return (history ?? []).filter((entry) => !isSkippedDraftTurn(entry)).length;
}

export function getRecentDraftActivity(
  lobby: ActivityLobby,
  limit = 5
): DraftActivityEvent[] {
  const history = lobby.history ?? [];
  let pickNumber = 0;

  const events = history.map((entry, index) => {
    const isSkip = isSkippedDraftTurn(entry);
    if (!isSkip) pickNumber += 1;

    const player = lobby.players[entry.playerIndex];

    return {
      eventNumber: index + 1,
      pickNumber: isSkip ? null : pickNumber,
      isSkip,
      playerName: player?.name ?? `Player ${entry.playerIndex + 1}`,
      playerColor: player?.color ?? null,
      characterName: isSkip ? "Turn skipped" : entry.char.name.full,
      imageUrl: isSkip ? "" : entry.char.image?.large ?? "",
      slot: isSkip ? "Timer expired" : entry.slot,
      round:
        typeof entry.previousRound === "number" ? entry.previousRound : null,
    };
  });

  const safeLimit = Math.max(0, Math.floor(limit));
  return safeLimit ? events.slice(-safeLimit).reverse() : [];
}
