import type { BlindRankingCount, BlindRankingItem } from "./blindRanking.ts";
import { isBlindRankingCount, selectBlindRankingItems } from "./blindRanking.ts";

export type CustomRankingEntry = {
  id: string;
  title: string;
  imageId: string;
  imageUrl: string;
};

export type CustomRanking = {
  id: string;
  slug: string;
  title: string;
  creator: string;
  description: string;
  tags: string[];
  playCount: BlindRankingCount;
  items: CustomRankingEntry[];
  playsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type StoredCustomRanking = CustomRanking & {
  manageKeyHash: string;
  searchText: string;
};

export type CustomRankingSummary = Omit<CustomRanking, "items"> & {
  itemCount: number;
  coverImages: string[];
};

export type CustomRankingDraft = {
  title: string;
  creator: string;
  description?: string;
  tags?: unknown;
  playCount: unknown;
  items: unknown;
};

function cleanSingleLine(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

export function normalizeCustomRankingDraft(input: CustomRankingDraft) {
  const title = cleanSingleLine(input.title, 80);
  const creator = cleanSingleLine(input.creator, 40);
  const description = cleanSingleLine(input.description, 320);
  const playCount = isBlindRankingCount(input.playCount) ? input.playCount : 5;
  const tags = Array.isArray(input.tags)
    ? Array.from(
        new Set(
          input.tags
            .map((tag) => cleanSingleLine(tag, 20).toLowerCase())
            .filter(Boolean)
        )
      ).slice(0, 8)
    : [];

  if (title.length < 3) throw new Error("Give the ranking a name of at least three characters.");
  if (!creator) throw new Error("Enter a creator name.");
  if (!Array.isArray(input.items)) throw new Error("Add ranking items first.");

  const items = input.items.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as { title?: unknown; imageId?: unknown };
    const itemTitle = cleanSingleLine(entry.title, 80);
    const imageId = cleanSingleLine(entry.imageId, 80);
    if (!itemTitle || !/^[a-zA-Z0-9_-]{12,80}$/.test(imageId)) return [];
    return [
      {
        id: `item-${index + 1}`,
        title: itemTitle,
        imageId,
        imageUrl: `/api/blind-ranking/custom/images/${imageId}`,
      },
    ];
  });

  if (items.length < playCount) {
    throw new Error(`Add at least ${playCount} titled images for a top ${playCount} game.`);
  }
  if (items.length > 30) throw new Error("Custom rankings can contain up to 30 items.");
  const uniqueTitles = new Set(items.map((item) => item.title.toLowerCase()));
  if (uniqueTitles.size !== items.length) {
    throw new Error("Each ranking item needs a different title.");
  }
  if (new Set(items.map((item) => item.imageId)).size !== items.length) {
    throw new Error("Upload a different picture for each ranking item.");
  }

  return { title, creator, description, tags, playCount, items };
}

export function buildCustomRankingSearchText(
  ranking: Pick<CustomRanking, "title" | "creator" | "description" | "tags" | "items">
) {
  return [
    ranking.title,
    ranking.creator,
    ranking.description,
    ranking.tags.join(" "),
    ranking.items.map((item) => item.title).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function customRankingSlug(title: string, suffix: string) {
  const words = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52);
  return `${words || "ranking"}-${suffix.toLowerCase()}`;
}

export function toCustomRankingSummary(
  ranking: CustomRanking
): CustomRankingSummary {
  const { items, ...rest } = ranking;
  return {
    ...rest,
    itemCount: items.length,
    coverImages: items.slice(0, 3).map((item) => item.imageUrl),
  };
}

export function toPublicCustomRanking(ranking: StoredCustomRanking): CustomRanking {
  return {
    id: ranking.id,
    slug: ranking.slug,
    title: ranking.title,
    creator: ranking.creator,
    description: ranking.description,
    tags: ranking.tags,
    playCount: ranking.playCount,
    items: ranking.items,
    playsCount: ranking.playsCount,
    createdAt: ranking.createdAt,
    updatedAt: ranking.updatedAt,
  };
}

export function selectCustomRankingPlay(
  ranking: CustomRanking,
  seed: string
): BlindRankingItem[] {
  const candidates = ranking.items.map(
    (entry): BlindRankingItem => ({
      id: `${ranking.id}:${entry.id}`,
      title: entry.title,
      image: entry.imageUrl,
      subtitle: ranking.title,
      genres: [],
      sourceUrl: `/blind-ranking/custom/${ranking.slug}`,
    })
  );
  return selectBlindRankingItems(candidates, ranking.playCount, seed);
}
