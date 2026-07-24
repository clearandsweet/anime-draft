import type { LobbyState } from "../api/lobby/logic";

export type PlayerDraftProgress = {
  id: string;
  name: string;
  color: string;
  filledSlots: number;
  totalSlots: number;
  remainingSlots: number;
};

export type DraftProgress = {
  filledSlots: number;
  totalSlots: number;
  remainingSlots: number;
  percentage: number;
  players: PlayerDraftProgress[];
};

export function getDraftProgress(
  players: LobbyState["players"]
): DraftProgress {
  const playerProgress = players.map((player) => {
    const slots = Object.values(player.slots ?? {});
    const filledSlots = slots.filter(Boolean).length;
    const totalSlots = slots.length;

    return {
      id: player.id,
      name: player.name,
      color: player.color,
      filledSlots,
      totalSlots,
      remainingSlots: Math.max(0, totalSlots - filledSlots),
    };
  });

  const filledSlots = playerProgress.reduce(
    (total, player) => total + player.filledSlots,
    0
  );
  const totalSlots = playerProgress.reduce(
    (total, player) => total + player.totalSlots,
    0
  );
  const remainingSlots = Math.max(0, totalSlots - filledSlots);
  const percentage = totalSlots
    ? Math.min(100, Math.round((filledSlots / totalSlots) * 100))
    : 0;

  return {
    filledSlots,
    totalSlots,
    remainingSlots,
    percentage,
    players: playerProgress,
  };
}
