import { anilistRequest } from "../../lib/anilist";
import type { ListCharacter, ListEntry, ListMedia } from "../../lib/shelf/shelf";

export type ShelfService = "anilist" | "mal";

const MAL_PAGE = 300;
const ANILIST_BATCH = 50;
const MAL_STATUS: Record<number, string> = { 1: "CURRENT", 2: "COMPLETED", 3: "PAUSED", 4: "DROPPED", 6: "PLANNING" };

export function cleanShelfUsername(username: unknown) {
  const cleaned = typeof username === "string" ? username.trim() : "";
  if (!cleaned || cleaned.length > 64 || !/^[\w.-]+$/i.test(cleaned)) {
    throw new Error("Enter a valid public AniList or MyAnimeList username.");
  }
  return cleaned;
}

// Everything a franchise needs: titles to search shops with, relations and main cast to group
// entries, and the most-favourited characters to recognise in listings.
const MEDIA_FIELDS = `
  id idMal format seasonYear popularity synonyms
  title { english romaji native }
  coverImage { medium }
  relations { edges { relationType node { id type } } }
  main: characters(role: MAIN, perPage: 12) { nodes { id } }
  top: characters(sort: FAVOURITES_DESC, perPage: 8) { nodes { id favourites name { full first last alternative } } }
`;

type RawMedia = {
  id: number;
  idMal?: number | null;
  format?: string | null;
  seasonYear?: number | null;
  popularity?: number | null;
  synonyms?: string[] | null;
  title?: { english?: string | null; romaji?: string | null; native?: string | null } | null;
  coverImage?: { medium?: string | null } | null;
  relations?: { edges?: { relationType?: string | null; node?: { id: number; type?: string | null } | null }[] | null } | null;
  main?: { nodes?: { id: number }[] | null } | null;
  top?: {
    nodes?: {
      id: number;
      favourites?: number | null;
      name?: { full?: string | null; first?: string | null; last?: string | null; alternative?: (string | null)[] | null } | null;
    }[] | null;
  } | null;
};

function toMedia(raw: RawMedia): ListMedia {
  return {
    id: raw.id,
    idMal: raw.idMal ?? null,
    format: raw.format ?? null,
    year: raw.seasonYear ?? null,
    popularity: raw.popularity ?? 0,
    title: { english: raw.title?.english ?? null, romaji: raw.title?.romaji ?? null, native: raw.title?.native ?? null },
    synonyms: (raw.synonyms ?? []).filter(Boolean),
    image: raw.coverImage?.medium ?? null,
    relations: (raw.relations?.edges ?? [])
      .filter((edge) => edge.node && edge.node.type === "ANIME" && edge.relationType)
      .map((edge) => ({ type: edge.relationType!, id: edge.node!.id })),
    main: (raw.main?.nodes ?? []).map((node) => node.id),
    top: (raw.top?.nodes ?? [])
      .filter((node) => node.name?.full)
      .map((node): ListCharacter => ({
        id: node.id,
        full: node.name!.full!,
        first: node.name?.first ?? null,
        last: node.name?.last ?? null,
        alternative: (node.name?.alternative ?? []).filter((name): name is string => Boolean(name)),
        favourites: node.favourites ?? 0,
      })),
  };
}

type AniListShelfResponse = {
  data?: {
    User?: { favourites?: { characters?: { nodes?: { id: number }[] } } } | null;
    MediaListCollection?: {
      lists?: {
        isCustomList?: boolean;
        entries?: { status?: string | null; score?: number | null; media?: RawMedia | null }[] | null;
      }[] | null;
    } | null;
  };
};

/** The whole anime list in one call (about 1 MB for 600 titles), plus favourite characters. */
export async function loadAniListShelf(username: string) {
  const query = `
    query ($userName: String!) {
      User(name: $userName) { favourites { characters(perPage: 25) { nodes { id } } } }
      MediaListCollection(userName: $userName, type: ANIME) {
        lists { isCustomList entries { status score(format: POINT_100) media { ${MEDIA_FIELDS} } } }
      }
    }
  `;
  // Not cached: each response is large and the page scores it in the browser.
  const response = await anilistRequest<AniListShelfResponse>(query, { userName: username }, 0);
  const byId = new Map<number, ListEntry>();
  for (const list of response.data?.MediaListCollection?.lists ?? []) {
    if (list.isCustomList) continue;
    for (const entry of list.entries ?? []) {
      if (!entry.media) continue;
      byId.set(entry.media.id, { media: toMedia(entry.media), score: entry.score ?? 0, status: entry.status ?? null });
    }
  }
  return {
    entries: [...byId.values()],
    favouriteCharacters: response.data?.User?.favourites?.characters?.nodes?.map((node) => node.id) ?? [],
    unmatched: 0,
  };
}

type MalEntry = { anime_id: number; score?: number; status?: number };

/** A public MAL list, then the same AniList details for its titles, 50 at a time. */
export async function loadMalShelf(username: string) {
  const mal: MalEntry[] = [];
  for (let offset = 0; offset < MAL_PAGE * 20; offset += MAL_PAGE) {
    const url = new URL(`https://myanimelist.net/animelist/${encodeURIComponent(username)}/load.json`);
    url.searchParams.set("status", "7");
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if ([400, 403, 404].includes(response.status)) {
      throw new Error(`MyAnimeList user ${username} was not found or has a private list.`);
    }
    if (!response.ok) throw new Error(`MyAnimeList could not be reached (${response.status}).`);
    const page = (await response.json()) as MalEntry[];
    mal.push(...page);
    if (page.length < MAL_PAGE) break;
  }

  const query = `query ($ids: [Int]) { Page(perPage: ${ANILIST_BATCH}) { media(idMal_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } } }`;
  const byMal = new Map<number, ListMedia>();
  const ids = [...new Set(mal.map((entry) => entry.anime_id))];
  for (let i = 0; i < ids.length; i += ANILIST_BATCH) {
    const batch = ids.slice(i, i + ANILIST_BATCH);
    const response = await anilistRequest<{ data?: { Page?: { media?: RawMedia[] } } }>(query, { ids: batch }, 30 * 60_000);
    for (const raw of response.data?.Page?.media ?? []) if (raw.idMal) byMal.set(raw.idMal, toMedia(raw));
  }
  const entries: ListEntry[] = [];
  for (const entry of mal) {
    const media = byMal.get(entry.anime_id);
    if (media) entries.push({ media, score: (entry.score ?? 0) * 10, status: MAL_STATUS[entry.status ?? 0] ?? null });
  }
  return { entries, favouriteCharacters: [] as number[], unmatched: mal.length - entries.length };
}
