export type DraftTurnPosition = {
  playerIndex: number;
  round: number;
};

export function getOpenSlotNames<T>(
  slots: Record<string, T | null | undefined>
) {
  return Object.entries(slots)
    .filter(([, draftedItem]) => draftedItem == null)
    .map(([slotName]) => slotName);
}

export function getUpcomingDraftTurns(
  playerCount: number,
  currentPlayerIndex: number,
  currentRound: number,
  limit = 4
): DraftTurnPosition[] {
  if (playerCount < 1 || limit < 1) return [];

  let playerIndex = Math.min(Math.max(currentPlayerIndex, 0), playerCount - 1);
  let round = Math.max(1, currentRound);
  const turns: DraftTurnPosition[] = [];

  for (let step = 0; step < limit; step += 1) {
    const movingForward = round % 2 === 1;
    const reachedEdge =
      (movingForward && playerIndex === playerCount - 1) ||
      (!movingForward && playerIndex === 0);

    if (reachedEdge) {
      round += 1;
    } else {
      playerIndex += movingForward ? 1 : -1;
    }

    turns.push({ playerIndex, round });
  }

  return turns;
}
