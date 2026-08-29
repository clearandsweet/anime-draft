export const BLIND_RANKING_COUNTS = [5, 7, 10] as const;

export const BLIND_RANKING_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
] as const;

export const BLIND_RANKING_STATUSES = [
  "completed",
  "watching",
  "planning",
  "dropped",
] as const;

export type BlindRankingCount = (typeof BLIND_RANKING_COUNTS)[number];
export type BlindRankingGenre = (typeof BLIND_RANKING_GENRES)[number];
export type BlindRankingStatus = (typeof BLIND_RANKING_STATUSES)[number];
export type BlindRankingMode = "anime" | "character";
export type BlindRankingService = "anilist" | "mal";

export type BlindRankingSource = {
  service: BlindRankingService;
  username: string;
};

export type BlindRankingItem = {
  id: string;
  title: string;
  image: string;
  subtitle: string;
  genres: string[];
  sourceUrl: string;
  contributors?: string[];
};

export type BlindRankingConfig = {
  mode: BlindRankingMode;
  count: BlindRankingCount;
  genres: string[];
  statuses: BlindRankingStatus[];
};

export function isBlindRankingCount(value: unknown): value is BlindRankingCount {
  return BLIND_RANKING_COUNTS.includes(value as BlindRankingCount);
}

export function isBlindRankingMode(value: unknown): value is BlindRankingMode {
  return value === "anime" || value === "character";
}

export function isBlindRankingService(
  value: unknown
): value is BlindRankingService {
  return value === "anilist" || value === "mal";
}

export function normalizeBlindRankingStatuses(
  value: unknown
): BlindRankingStatus[] {
  if (!Array.isArray(value)) return [...BLIND_RANKING_STATUSES];
  const selected = BLIND_RANKING_STATUSES.filter((status) =>
    value.includes(status)
  );
  return selected.length ? selected : [...BLIND_RANKING_STATUSES];
}

export function normalizeBlindRankingGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(BLIND_RANKING_GENRES);
  return Array.from(
    new Set(
      value
        .filter((genre): genre is string => typeof genre === "string")
        .map((genre) => genre.trim())
        .filter((genre) => allowed.has(genre))
    )
  );
}

export function matchesBlindRankingGenres(
  item: BlindRankingItem,
  selectedGenres: string[]
) {
  if (!selectedGenres.length) return true;
  const itemGenres = new Set(item.genres.map((genre) => genre.toLowerCase()));
  return selectedGenres.some((genre) => itemGenres.has(genre.toLowerCase()));
}

export function mergeBlindRankingCandidates(
  candidateGroups: { contributor: string; items: BlindRankingItem[] }[]
) {
  const byId = new Map<string, BlindRankingItem>();
  for (const group of candidateGroups) {
    for (const item of group.items) {
      const existing = byId.get(item.id);
      if (existing) {
        existing.contributors = Array.from(
          new Set([...(existing.contributors ?? []), group.contributor])
        );
      } else {
        byId.set(item.id, {
          ...item,
          contributors: group.contributor ? [group.contributor] : [],
        });
      }
    }
  }
  return Array.from(byId.values());
}

function xmur3(seed: string) {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectBlindRankingItems(
  candidates: BlindRankingItem[],
  count: number,
  seed: string
) {
  const random = mulberry32(xmur3(seed)());
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled.slice(0, count);
}

export function createBlindRankingBoard(count: number) {
  return Array.from({ length: count }, () => null as BlindRankingItem | null);
}

export function placeBlindRankingItem(
  board: (BlindRankingItem | null)[],
  slot: number,
  item: BlindRankingItem
) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= board.length) {
    return { ok: false as const, error: "Choose a valid ranking slot." };
  }
  if (board[slot]) {
    return { ok: false as const, error: "That ranking slot is already locked." };
  }
  const nextBoard = [...board];
  nextBoard[slot] = item;
  return { ok: true as const, board: nextBoard };
}

export function blindRankingStatusLabel(status: BlindRankingStatus) {
  if (status === "completed") return "Watched";
  if (status === "watching") return "Watching";
  if (status === "planning") return "Plan to watch";
  return "Dropped";
}
