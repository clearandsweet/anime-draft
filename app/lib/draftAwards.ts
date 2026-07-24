export type DraftAwardPlayer = {
  name: string;
  color: string;
};

export type DraftAwardHistoryEntry = {
  playerIndex: number;
  char: {
    id: number;
    name: { full: string };
    image?: { large?: string };
    favourites?: number;
  };
  slot: string;
};

export type DraftAward = {
  id: "opening-move" | "fan-favorite" | "deep-cut" | "final-flourish";
  title: string;
  description: string;
  playerName: string;
  playerColor: string | null;
  characterName: string;
  imageUrl: string;
  slot: string;
  pickNumber: number;
  popularity: number | null;
};

type DraftPick = {
  historyIndex: number;
  pickNumber: number;
  playerName: string;
  playerColor: string | null;
  characterName: string;
  imageUrl: string;
  slot: string;
  popularity: number | null;
};

function isSkippedTurn(entry: DraftAwardHistoryEntry) {
  return entry.slot === "AUTO_SKIP" || entry.char.id === -1;
}

export function getDraftAwards(
  history: DraftAwardHistoryEntry[],
  players: DraftAwardPlayer[]
): DraftAward[] {
  let completedPickNumber = 0;
  const picks: DraftPick[] = history.flatMap((entry, historyIndex) => {
    if (isSkippedTurn(entry)) return [];
    completedPickNumber += 1;
    const player = players[entry.playerIndex];
    const popularity = Number.isFinite(entry.char.favourites)
      ? Number(entry.char.favourites)
      : null;

    return [
      {
        historyIndex,
        pickNumber: completedPickNumber,
        playerName: player?.name ?? `Player ${entry.playerIndex + 1}`,
        playerColor: player?.color ?? null,
        characterName: entry.char.name.full,
        imageUrl: entry.char.image?.large ?? "",
        slot: entry.slot,
        popularity,
      },
    ];
  });

  if (!picks.length) return [];

  const popularityPicks = picks.filter(
    (pick): pick is DraftPick & { popularity: number } =>
      pick.popularity !== null
  );
  const fanFavorite = popularityPicks.reduce<DraftPick | null>(
    (best, pick) =>
      best === null || pick.popularity! > best.popularity! ? pick : best,
    null
  );
  const deepCut = popularityPicks.reduce<DraftPick | null>(
    (best, pick) =>
      best === null || pick.popularity! < best.popularity! ? pick : best,
    null
  );

  const candidates: Array<{
    pick: DraftPick | null;
    award: Pick<DraftAward, "id" | "title" | "description">;
  }> = [
    {
      pick: picks[0],
      award: {
        id: "opening-move",
        title: "Opening Move",
        description: "The selection that set the draft in motion.",
      },
    },
    {
      pick: fanFavorite,
      award: {
        id: "fan-favorite",
        title: "Fan Favorite",
        description: "The highest-popularity selection in the room.",
      },
    },
    {
      pick: deepCut,
      award: {
        id: "deep-cut",
        title: "Deep Cut",
        description: "The room’s boldest low-profile selection.",
      },
    },
    {
      pick: picks.at(-1) ?? null,
      award: {
        id: "final-flourish",
        title: "Final Flourish",
        description: "The pick that closed out the draft.",
      },
    },
  ];

  const awardedHistoryIndexes = new Set<number>();
  return candidates.flatMap(({ pick, award }) => {
    if (!pick || awardedHistoryIndexes.has(pick.historyIndex)) return [];
    awardedHistoryIndexes.add(pick.historyIndex);

    return [
      {
        ...award,
        playerName: pick.playerName,
        playerColor: pick.playerColor,
        characterName: pick.characterName,
        imageUrl: pick.imageUrl,
        slot: pick.slot,
        pickNumber: pick.pickNumber,
        popularity: pick.popularity,
      },
    ];
  });
}
