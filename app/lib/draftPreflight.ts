export type DraftPreflightPreset = "classic" | "blitz" | "chaos";

type DraftPreflightInput = {
  playerNames: string[];
  slotNames: string[];
  preset?: DraftPreflightPreset;
  timerDuration?: number;
};

export type DraftPreflightSummary = {
  playerNames: string[];
  slotNames: string[];
  playerCount: number;
  slotsPerPlayer: number;
  totalPicks: number;
  timerSeconds: number;
  timerLabel: string;
  maximumClockSeconds: number;
  maximumClockLabel: string;
  preset: DraftPreflightPreset;
  presetLabel: string;
  isSolo: boolean;
};

const PRESET_DETAILS: Record<
  DraftPreflightPreset,
  { label: string; timerSeconds: number }
> = {
  classic: { label: "Classic", timerSeconds: 300 },
  blitz: { label: "Blitz", timerSeconds: 60 },
  chaos: { label: "Chaos", timerSeconds: 90 },
};

function normalizePreset(
  preset: DraftPreflightInput["preset"]
): DraftPreflightPreset {
  return preset === "blitz" || preset === "chaos" ? preset : "classic";
}

function normalizeTimer(timerDuration: number | undefined, fallback: number) {
  return typeof timerDuration === "number" &&
    Number.isFinite(timerDuration) &&
    timerDuration > 0
    ? Math.floor(timerDuration)
    : fallback;
}

export function formatDraftDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds} sec`;

  const totalMinutes = Math.ceil(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function formatPickTimer(totalSeconds: number) {
  return totalSeconds < 180 && totalSeconds % 60 !== 0
    ? `${totalSeconds} sec`
    : formatDraftDuration(totalSeconds);
}

export function getDraftPreflight(
  input: DraftPreflightInput
): DraftPreflightSummary {
  const preset = normalizePreset(input.preset);
  const presetDetails = PRESET_DETAILS[preset];
  const playerNames = input.playerNames.map(
    (name, index) => name.trim() || `Player ${index + 1}`
  );
  const slotNames = input.slotNames
    .map((name) => name.trim())
    .filter(Boolean);
  const playerCount = playerNames.length;
  const slotsPerPlayer = slotNames.length;
  const totalPicks = playerCount * slotsPerPlayer;
  const timerSeconds = normalizeTimer(
    input.timerDuration,
    presetDetails.timerSeconds
  );
  const maximumClockSeconds = totalPicks * timerSeconds;

  return {
    playerNames,
    slotNames,
    playerCount,
    slotsPerPlayer,
    totalPicks,
    timerSeconds,
    timerLabel: formatPickTimer(timerSeconds),
    maximumClockSeconds,
    maximumClockLabel: formatDraftDuration(maximumClockSeconds),
    preset,
    presetLabel: presetDetails.label,
    isSolo: playerCount === 1,
  };
}
