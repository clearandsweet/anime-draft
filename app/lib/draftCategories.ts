import type { LobbyState } from "../api/lobby/logic";

type CategoryState = Pick<
  LobbyState,
  | "players"
  | "hostName"
  | "startedAt"
  | "completedAt"
  | "draftActive"
  | "categoryMode"
  | "slotNames"
  | "version"
>;

export type RerollCategoryResult = {
  ok: boolean;
  error?: string;
  previousSlot?: string;
  nextSlot?: string;
};

export function rerollLobbyCategory(
  state: CategoryState,
  requesterName: string,
  slotName: string,
  categoryPool: string[],
  randomValue = Math.random()
): RerollCategoryResult {
  const requesterIsHost =
    Boolean(state.hostName) &&
    requesterName.trim().toLowerCase() === state.hostName?.toLowerCase();
  if (!requesterIsHost) {
    return { ok: false, error: "Only the host can reroll categories." };
  }
  if (state.startedAt || state.draftActive || state.completedAt) {
    return {
      ok: false,
      error: "Categories can only change before the draft starts.",
    };
  }
  if (state.categoryMode !== "random") {
    return {
      ok: false,
      error: "Switch to random categories before rerolling one slot.",
    };
  }

  const normalizedSlotName = slotName.trim();
  const slotIndex = state.slotNames.indexOf(normalizedSlotName);
  if (slotIndex < 0) {
    return { ok: false, error: "That category is no longer on the board." };
  }

  const usedCategories = new Set(state.slotNames);
  const candidates = Array.from(
    new Set(categoryPool.map((category) => category.trim()).filter(Boolean))
  ).filter(
    (category) =>
      category !== normalizedSlotName && !usedCategories.has(category)
  );
  if (!candidates.length) {
    return { ok: false, error: "No unused categories are available." };
  }

  const boundedRandom = Number.isFinite(randomValue)
    ? Math.min(0.999999, Math.max(0, randomValue))
    : 0;
  const nextSlot = candidates[Math.floor(boundedRandom * candidates.length)];
  const nextSlotNames = [...state.slotNames];
  nextSlotNames[slotIndex] = nextSlot;
  state.slotNames = nextSlotNames;

  for (const player of state.players) {
    const previousSlots = player.slots ?? {};
    const nextSlots: typeof player.slots = {};
    for (const category of nextSlotNames) {
      nextSlots[category] =
        category === nextSlot ? null : previousSlots[category] ?? null;
    }
    player.slots = nextSlots;
  }

  state.version += 1;
  return {
    ok: true,
    previousSlot: normalizedSlotName,
    nextSlot,
  };
}
