export type DraftRecapShareType = "anime" | "pokemon";

export type DraftRecapShareAward = {
  title: string;
  characterName: string;
  playerName: string;
};

type DraftRecapShareInput = {
  draftType: DraftRecapShareType;
  lobbyId: string;
  playerNames: string[];
  completedPicks: number;
  presetLabel: string;
  awards?: DraftRecapShareAward[];
};

function getDraftLabel(draftType: DraftRecapShareType) {
  return draftType === "pokemon" ? "Pokémon Draft" : "Anime Draft";
}

function cleanNames(playerNames: string[]) {
  return playerNames.map((name) => name.trim()).filter(Boolean);
}

export function getDraftRecapRoute(
  draftType: DraftRecapShareType,
  lobbyId: string
) {
  const roomPath = draftType === "pokemon" ? "pokemon-lobby" : "lobby";
  return `/${roomPath}/${encodeURIComponent(lobbyId)}/vote`;
}

export function getDraftRecapTitle(
  draftType: DraftRecapShareType,
  lobbyId: string
) {
  return `${getDraftLabel(draftType)} #${lobbyId} Recap`;
}

export function getDraftRecapText({
  draftType,
  lobbyId,
  playerNames,
  completedPicks,
  presetLabel,
  awards = [],
}: DraftRecapShareInput) {
  const names = cleanNames(playerNames);
  const playerCount = names.length;
  const safePickCount = Math.max(0, Math.floor(completedPicks));
  const safePresetLabel = presetLabel.trim() || "Classic";
  const lines = [
    `${getDraftLabel(draftType)} #${lobbyId} is complete: ${playerCount} ${
      playerCount === 1 ? "player" : "players"
    }, ${safePickCount} ${safePickCount === 1 ? "pick" : "picks"}, ${safePresetLabel} format.`,
  ];

  if (names.length) {
    lines.push(`Boards: ${names.join(", ")}.`);
  }

  const highlights = awards
    .filter(
      (award) =>
        award.title.trim() &&
        award.characterName.trim() &&
        award.playerName.trim()
    )
    .slice(0, 4)
    .map(
      (award) =>
        `${award.title.trim()} - ${award.characterName.trim()} (${award.playerName.trim()})`
    );

  if (highlights.length) {
    lines.push(`Highlights: ${highlights.join("; ")}.`);
  }

  lines.push("See every board, pick, and vote in the permanent recap.");
  return lines.join("\n");
}

