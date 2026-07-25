import type { LobbyState } from "../api/lobby/logic";

type DraftOrderState = Pick<
  LobbyState,
  | "players"
  | "hostName"
  | "startedAt"
  | "completedAt"
  | "draftActive"
  | "orderShuffled"
  | "version"
>;

export type ShuffleDraftOrderResult = {
  ok: boolean;
  error?: string;
};

function samePlayerOrder(
  before: Array<{ id: string }>,
  after: Array<{ id: string }>
) {
  return before.every((player, index) => player.id === after[index]?.id);
}

function shuffleWithRandom<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = Math.min(Math.max(random(), 0), 0.999999999);
    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function getDraftLaunchOrder<T>(
  players: T[],
  orderShuffled: boolean,
  random: () => number = Math.random
) {
  return orderShuffled ? [...players] : shuffleWithRandom(players, random);
}

export function shuffleDraftPlayerOrder(
  state: DraftOrderState,
  requesterName: string,
  random: () => number = Math.random
): ShuffleDraftOrderResult {
  const requesterIsHost =
    Boolean(state.hostName) &&
    requesterName.trim().toLowerCase() === state.hostName?.toLowerCase();
  if (!requesterIsHost) {
    return { ok: false, error: "Only the host can shuffle draft order." };
  }
  if (state.startedAt || state.draftActive || state.completedAt) {
    return {
      ok: false,
      error: "Draft order can only change before the draft starts.",
    };
  }
  if (state.players.length < 2) {
    return {
      ok: false,
      error: "At least two players are needed to shuffle draft order.",
    };
  }

  const nextPlayers = shuffleWithRandom(state.players, random);

  if (samePlayerOrder(state.players, nextPlayers)) {
    nextPlayers.push(nextPlayers.shift()!);
  }

  state.players = nextPlayers;
  state.orderShuffled = true;
  state.version += 1;
  return { ok: true };
}
