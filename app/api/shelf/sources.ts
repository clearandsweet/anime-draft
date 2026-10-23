import { anilistRequest } from "../../lib/anilist";
import type { ListEntry } from "../../lib/shelf/shelf";

export type ShelfService = "anilist" | "mal";

const MAL_PAGE = 300;
const MAL_STATUS: Record<number, string> = { 1: "CURRENT", 2: "COMPLETED", 3: "PAUSED", 4: "DROPPED", 6: "PLANNING" };

export function cleanShelfUsername(username: unknown) {
  const cleaned = typeof username === "string" ? username.trim() : "";
  if (!cleaned || cleaned.length > 64 || !/^[\w.-]+$/i.test(cleaned)) {
    throw new Error("Enter a valid public AniList or MyAnimeList username.");
  }
  return cleaned;
}

type AniListShelfResponse = {
  data?: {
    User?: { favourites?: { characters?: { nodes?: { id: number }[] } } } | null;
    MediaListCollection?: {
      lists?: {
        isCustomList?: boolean;
        entries?: {
          status?: string | null;
          score?: number | null;
          media?: { id: number; idMal?: number | null; title?: { english?: string | null; romaji?: string | null } } | null;
        }[] | null;
      }[] | null;
    } | null;
  };
};

export async function loadAniListShelf(username: string) {
  const query = `
    query ($userName: String!) {
      User(name: $userName) { favourites { characters(perPage: 25) { nodes { id } } } }
      MediaListCollection(userName: $userName, type: ANIME) {
        lists {
          isCustomList
          entries {
            status
            score(format: POINT_100)
            media { id idMal title { english romaji } }
          }
        }
      }
    }
  `;
  const response = await anilistRequest<AniListShelfResponse>(query, { userName: username }, 60_000);
  const byId = new Map<number, ListEntry>();
  for (const list of response.data?.MediaListCollection?.lists ?? []) {
    if (list.isCustomList) continue;
    for (const entry of list.entries ?? []) {
      if (!entry.media) continue;
      byId.set(entry.media.id, {
        anilistId: entry.media.id,
        malId: entry.media.idMal ?? null,
        score: entry.score ?? 0,
        status: entry.status ?? null,
        title: entry.media.title?.english || entry.media.title?.romaji || "Untitled",
      });
    }
  }
  return {
    entries: [...byId.values()],
    favouriteCharacters: response.data?.User?.favourites?.characters?.nodes?.map((node) => node.id) ?? [],
  };
}

type MalEntry = { anime_id: number; anime_title?: string | null; anime_title_eng?: string | null; score?: number; status?: number };

export async function loadMalShelf(username: string) {
  const entries: ListEntry[] = [];
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
    for (const entry of page) {
      entries.push({
        anilistId: null,
        malId: entry.anime_id,
        score: (entry.score ?? 0) * 10,
        status: MAL_STATUS[entry.status ?? 0] ?? null,
        title: entry.anime_title_eng || entry.anime_title || "Untitled",
      });
    }
    if (page.length < MAL_PAGE) break;
  }
  return { entries, favouriteCharacters: [] as number[] };
}
