export type DraftPickAvailability = {
  canPick: boolean;
  label: string;
  detail: string;
  tone: "ready" | "waiting" | "paused" | "complete" | "watching" | "full";
};

type DraftPickAvailabilityInput = {
  draftActive: boolean;
  isPaused: boolean;
  completedAt?: string | null;
  currentPlayerName?: string | null;
  viewerName?: string | null;
  viewerOpenSlotCount: number;
};

export function getDraftPickAvailability({
  draftActive,
  isPaused,
  completedAt,
  currentPlayerName,
  viewerName,
  viewerOpenSlotCount,
}: DraftPickAvailabilityInput): DraftPickAvailability {
  if (completedAt && !draftActive) {
    return {
      canPick: false,
      label: "Draft complete",
      detail: "The final boards are locked in.",
      tone: "complete",
    };
  }

  if (isPaused || !draftActive) {
    return {
      canPick: false,
      label: "Draft paused",
      detail: "You can keep scouting while picks are paused.",
      tone: "paused",
    };
  }

  const currentName = currentPlayerName?.trim() ?? "";
  const viewer = viewerName?.trim() ?? "";
  if (!viewer) {
    return {
      canPick: false,
      label: currentName ? `${currentName} is on the clock` : "Watching draft",
      detail: "Join as a player to make picks. Scouting remains available.",
      tone: "watching",
    };
  }

  if (
    !currentName ||
    currentName.toLocaleLowerCase() !== viewer.toLocaleLowerCase()
  ) {
    return {
      canPick: false,
      label: currentName ? `${currentName} is on the clock` : "Waiting for turn",
      detail: "Keep building your private Scout queue while you wait.",
      tone: "waiting",
    };
  }

  if (viewerOpenSlotCount <= 0) {
    return {
      canPick: false,
      label: "Your board is full",
      detail: "You can still follow the remaining picks.",
      tone: "full",
    };
  }

  return {
    canPick: true,
    label: "You're on the clock",
    detail: `${viewerOpenSlotCount} open ${
      viewerOpenSlotCount === 1 ? "category" : "categories"
    } on your board.`,
    tone: "ready",
  };
}
