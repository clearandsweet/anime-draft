import type {
  HistoryEntry,
  LobbyState,
  Player,
} from "../api/lobby/logic";

export type DraftUndoExpectation = {
  historyLength: number;
  playerIndex: number;
  characterId: number;
  slot: string;
};

export type DraftUndoPreview = {
  kind: "pick" | "skip";
  playerName: string;
  playerColor: string | null;
  characterName: string;
  imageUrl: string;
  slot: string;
  reopensCompletedDraft: boolean;
  expectation: DraftUndoExpectation;
};

export function isDraftUndoExpectation(
  value: unknown
): value is DraftUndoExpectation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DraftUndoExpectation>;
  return (
    Number.isInteger(candidate.historyLength) &&
    Number(candidate.historyLength) > 0 &&
    Number.isInteger(candidate.playerIndex) &&
    Number(candidate.playerIndex) >= 0 &&
    Number.isInteger(candidate.characterId) &&
    typeof candidate.slot === "string" &&
    candidate.slot.length > 0
  );
}

type UndoPreviewLobby = Pick<
  LobbyState,
  "history" | "players" | "completedAt"
>;

function isSkippedTurn(entry: HistoryEntry) {
  return entry.slot === "AUTO_SKIP" || entry.char.id === -1;
}

export function getDraftUndoExpectation(
  entry: HistoryEntry,
  historyLength: number
): DraftUndoExpectation {
  return {
    historyLength,
    playerIndex: entry.playerIndex,
    characterId: entry.char.id,
    slot: entry.slot,
  };
}

export function matchesDraftUndoExpectation(
  history: HistoryEntry[],
  expectation: DraftUndoExpectation
) {
  const latest = history.at(-1);
  return Boolean(
    latest &&
      history.length === expectation.historyLength &&
      latest.playerIndex === expectation.playerIndex &&
      latest.char.id === expectation.characterId &&
      latest.slot === expectation.slot
  );
}

export function getDraftUndoPreview(
  lobby: UndoPreviewLobby
): DraftUndoPreview | null {
  const latest = lobby.history.at(-1);
  if (!latest) return null;

  const player: Player | undefined = lobby.players[latest.playerIndex];
  const skipped = isSkippedTurn(latest);

  return {
    kind: skipped ? "skip" : "pick",
    playerName: player?.name ?? `Player ${latest.playerIndex + 1}`,
    playerColor: player?.color ?? null,
    characterName: skipped ? "Skipped turn" : latest.char.name.full,
    imageUrl: skipped ? "" : latest.char.image?.large ?? "",
    slot: skipped ? "Timer expired" : latest.slot,
    reopensCompletedDraft: Boolean(lobby.completedAt),
    expectation: getDraftUndoExpectation(latest, lobby.history.length),
  };
}
