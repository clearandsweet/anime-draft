import {
  BlindRankingItem,
  BlindRankingMode,
  BlindRankingSource,
  BlindRankingStatus,
  matchesBlindRankingGenres,
  mergeBlindRankingCandidates,
  selectBlindRankingItems,
} from "../../lib/blindRanking";

const ANILIST_URL = "https://graphql.anilist.co";
const MAL_LIST_URL = "https://myanimelist.net/animelist";

type AniListMedia = {
  id: number;
  idMal?: number | null;
  title?: { english?: string | null; romaji?: string | null } | null;
  coverImage?: { extraLarge?: string | null; large?: string | null } | null;
  seasonYear?: number | null;
  format?: string | null;
  genres?: string[] | null;
  siteUrl?: string | null;
};

type AniListEntry = {
  status?: string | null;
  media?: AniListMedia | null;
};

type AniListListResponse = {
  data?: {
    MediaListCollection?: {
      lists?: { entries?: AniListEntry[] | null }[] | null;
    } | null;
  };
  errors?: { message?: string }[];
};

type MalPublicEntry = {
  anime_id: number;
  anime_title?: string | null;
  anime_title_eng?: string | null;
  anime_image_path?: string | null;
  anime_media_type_string?: string | null;
  anime_url?: string | null;
  genres?: { name?: string | null }[] | null;
  demographics?: { name?: string | null }[] | null;
};

const ANILIST_STATUS_MAP: Record<BlindRankingStatus, string[]> = {
  completed: ["COMPLETED"],
  watching: ["CURRENT", "REPEATING"],
  planning: ["PLANNING"],
  dropped: ["DROPPED"],
};

const MAL_STATUS_MAP: Record<BlindRankingStatus, number> = {
  watching: 1,
  completed: 2,
  dropped: 4,
  planning: 6,
};

function cleanUsername(username: string) {
  const cleaned = username.trim();
  if (!cleaned || cleaned.length > 64 || !/^[\w.-]+$/i.test(cleaned)) {
    throw new Error("Enter a valid public AniList or MyAnimeList username.");
  }
  return cleaned;
}

function animeSubtitle(media: AniListMedia) {
  return [media.seasonYear || null, media.format?.replaceAll("_", " ") || null]
    .filter(Boolean)
    .join(" · ");
}

function normalizeAniListMedia(media: AniListMedia): BlindRankingItem {
  return {
    id: media.idMal ? `mal-anime:${media.idMal}` : `anilist-anime:${media.id}`,
    title: media.title?.english || media.title?.romaji || "Untitled anime",
    image: media.coverImage?.extraLarge || media.coverImage?.large || "",
    subtitle: animeSubtitle(media),
    genres: media.genres ?? [],
    sourceUrl: media.siteUrl || `https://anilist.co/anime/${media.id}`,
  };
}

async function anilistRequest<T>(query: string, variables: object): Promise<T> {
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`AniList could not be reached (${response.status}).`);
  }
  return (await response.json()) as T;
}

async function loadAniList(
  username: string,
  statuses: BlindRankingStatus[]
) {
  const query = `
    query ($userName: String!) {
      MediaListCollection(userName: $userName, type: ANIME) {
        lists {
          entries {
            status
            media {
              id
              idMal
              title { english romaji }
              coverImage { extraLarge large }
              seasonYear
              format
              genres
              siteUrl
            }
          }
        }
      }
    }
  `;
  const cleaned = cleanUsername(username);
  let response: AniListListResponse;
  try {
    response = await anilistRequest<AniListListResponse>(query, {
      userName: cleaned,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("(404)")) {
      throw new Error(`AniList user ${cleaned} was not found or has a private list.`);
    }
    throw error;
  }
  if (response.errors?.length) {
    throw new Error(
      response.errors[0]?.message || `AniList user ${cleaned} was not found.`
    );
  }
  const allowed = new Set(statuses.flatMap((status) => ANILIST_STATUS_MAP[status]));
  const entries =
    response.data?.MediaListCollection?.lists?.flatMap(
      (list) => list.entries ?? []
    ) ?? [];
  const byId = new Map<number, BlindRankingItem>();
  for (const entry of entries) {
    if (!entry.media || !entry.status || !allowed.has(entry.status)) continue;
    byId.set(entry.media.id, normalizeAniListMedia(entry.media));
  }
  return Array.from(byId.values());
}

function normalizeMalAnime(anime: MalPublicEntry): BlindRankingItem {
  const genres = [
    ...(anime.genres ?? []),
    ...(anime.demographics ?? []),
  ]
    .map((genre) => genre.name || "")
    .filter(Boolean);
  return {
    id: `mal-anime:${anime.anime_id}`,
    title: anime.anime_title_eng || anime.anime_title || "Untitled anime",
    image: anime.anime_image_path || "",
    subtitle: anime.anime_media_type_string || "Anime",
    genres,
    sourceUrl: anime.anime_url
      ? new URL(anime.anime_url, "https://myanimelist.net").toString()
      : `https://myanimelist.net/anime/${anime.anime_id}`,
  };
}

async function fetchMalStatus(username: string, status: number) {
  const url = new URL(`${MAL_LIST_URL}/${encodeURIComponent(username)}/load.json`);
  url.searchParams.set("status", String(status));
  url.searchParams.set("offset", "0");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if ([400, 403, 404].includes(response.status)) {
    throw new Error(`MyAnimeList user ${username} was not found or has a private list.`);
  }
  if (!response.ok) {
    throw new Error(`MyAnimeList could not be reached (${response.status}).`);
  }
  return (await response.json()) as MalPublicEntry[];
}

async function loadMal(username: string, statuses: BlindRankingStatus[]) {
  const cleaned = cleanUsername(username);
  const byId = new Map<number, BlindRankingItem>();
  for (const selectedStatus of statuses) {
    const status = MAL_STATUS_MAP[selectedStatus];
    const entries = await fetchMalStatus(cleaned, status);
    for (const entry of entries) {
      if (entry?.anime_id) {
        byId.set(entry.anime_id, normalizeMalAnime(entry));
      }
    }
  }
  return Array.from(byId.values());
}

async function loadPublicAnime(genres: string[], seed: string) {
  const query = `
    query ($page: Int!, $genres: [String]) {
      Page(page: $page, perPage: 50) {
        media(type: ANIME, sort: POPULARITY_DESC, genre_in: $genres, isAdult: false) {
          id
          title { english romaji }
          coverImage { extraLarge large }
          seasonYear
          format
          genres
          siteUrl
        }
      }
    }
  `;
  const pageSeed = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  const pages = [1 + (pageSeed % 8), 1 + ((pageSeed + 3) % 8)];
  const responses = await Promise.all(
    pages.map((page) =>
      anilistRequest<{
        data?: { Page?: { media?: AniListMedia[] | null } | null };
      }>(query, { page, genres: genres.length ? genres : null })
    )
  );
  return responses.flatMap((response) =>
    (response.data?.Page?.media ?? []).map(normalizeAniListMedia)
  );
}

async function loadPublicCharacters(seed: string) {
  const query = `
    query ($page: Int!) {
      Page(page: $page, perPage: 50) {
        characters(sort: FAVOURITES_DESC) {
          id
          name { full }
          image { large }
          siteUrl
          media(perPage: 3, sort: POPULARITY_DESC) {
            nodes { title { english romaji } }
          }
        }
      }
    }
  `;
  const pageSeed = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  const page = 1 + (pageSeed % 10);
  const response = await anilistRequest<{
    data?: {
      Page?: {
        characters?: {
          id: number;
          name?: { full?: string | null } | null;
          image?: { large?: string | null } | null;
          siteUrl?: string | null;
          media?: {
            nodes?: {
              title?: { english?: string | null; romaji?: string | null } | null;
            }[];
          } | null;
        }[];
      };
    };
  }>(query, { page });
  return (response.data?.Page?.characters ?? []).map(
    (character): BlindRankingItem => ({
      id: `anilist-character:${character.id}`,
      title: character.name?.full || "Unknown character",
      image: character.image?.large || "",
      subtitle:
        character.media?.nodes
          ?.map((media) => media.title?.english || media.title?.romaji || "")
          .filter(Boolean)
          .slice(0, 2)
          .join(" · ") || "Anime character",
      genres: [],
      sourceUrl:
        character.siteUrl || `https://anilist.co/character/${character.id}`,
    })
  );
}

export async function loadBlindRankingCandidates(options: {
  mode: BlindRankingMode;
  sources: { contributor: string; source: BlindRankingSource }[];
  statuses: BlindRankingStatus[];
  genres: string[];
  count: number;
  seed: string;
}) {
  const { mode, sources, statuses, genres, count, seed } = options;
  let candidates: BlindRankingItem[];

  if (mode === "character") {
    candidates = await loadPublicCharacters(seed);
  } else if (sources.length) {
    const groups = [];
    for (const entry of sources) {
      const items =
        entry.source.service === "anilist"
          ? await loadAniList(entry.source.username, statuses)
          : await loadMal(entry.source.username, statuses);
      groups.push({ contributor: entry.contributor, items });
    }
    candidates = mergeBlindRankingCandidates(groups);
  } else {
    candidates = await loadPublicAnime(genres, seed);
  }

  const eligible = candidates.filter((item) =>
    matchesBlindRankingGenres(item, genres)
  );
  return {
    items: selectBlindRankingItems(eligible, count, seed),
    candidateCount: eligible.length,
  };
}
