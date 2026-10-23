import { anilistRequest } from "../../lib/anilist";
import {
  pickWikidataCharacters,
  rankWikidataWorks,
  ratingKey,
  type CharacterResult,
  type WikidataEntity,
  type WorkResult,
} from "../../lib/shelf/characters";

const WIKIDATA = "https://www.wikidata.org/w/api.php";
// Wikidata asks every client to identify itself.
const WIKIDATA_HEADERS = { Accept: "application/json", "User-Agent": "ClearAndSweetFigureShelf/1.0 (https://godisaloli.com)" };
const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expires: number; value: unknown }>();

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + ttl, value });
  return value;
}

async function wikidata<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(WIKIDATA);
  for (const [key, value] of Object.entries({ ...params, format: "json", origin: "*" })) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: WIKIDATA_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Wikidata could not be reached (${response.status}).`);
  return (await response.json()) as T;
}

type AniListSearch = {
  data?: { Page?: { media?: { id: number; format?: string | null; seasonYear?: number | null; title?: { english?: string | null; romaji?: string | null }; coverImage?: { medium?: string | null } }[] } };
};

export function searchShows(query: string): Promise<WorkResult[]> {
  return cached(`show:${query.toLowerCase()}`, DAY, async () => {
    const response = await anilistRequest<AniListSearch>(
      `query ($q: String) { Page(perPage: 8) { media(search: $q, type: ANIME, sort: SEARCH_MATCH) {
        id format seasonYear title { english romaji } coverImage { medium } } } }`,
      { q: query },
      DAY
    );
    return (response.data?.Page?.media ?? []).map((m) => ({
      source: "anilist" as const,
      id: String(m.id),
      title: m.title?.english || m.title?.romaji || "Untitled",
      subtitle: [m.seasonYear, m.format?.replaceAll("_", " ")].filter(Boolean).join(" · "),
      image: m.coverImage?.medium ?? null,
    }));
  });
}

export function searchGames(query: string): Promise<WorkResult[]> {
  return cached(`game:${query.toLowerCase()}`, DAY, async () => {
    const response = await wikidata<{ search?: { id: string; label?: string; description?: string }[] }>({
      action: "wbsearchentities", search: query, language: "en", type: "item", limit: "10",
    });
    return rankWikidataWorks(response.search ?? []).slice(0, 8);
  });
}

type AniListCharacters = {
  data?: { Media?: { characters?: { nodes?: { id: number; name?: { full?: string | null }; image?: { medium?: string | null }; favourites?: number | null }[] } } };
};

export function showCharacters(mediaId: number): Promise<CharacterResult[]> {
  return cached(`show-chars:${mediaId}`, DAY, async () => {
    const response = await anilistRequest<AniListCharacters>(
      `query ($id: Int) { Media(id: $id, type: ANIME) { characters(sort: FAVOURITES_DESC, perPage: 5) {
        nodes { id name { full } image { medium } favourites } } } }`,
      { id: mediaId },
      DAY
    );
    return (response.data?.Media?.characters?.nodes ?? []).map((c) => ({
      key: ratingKey("anilist", c.id),
      name: c.name?.full || "Unknown character",
      image: c.image?.medium ?? null,
      popularity: c.favourites ?? 0,
      popularityLabel: `${(c.favourites ?? 0).toLocaleString("en-US")} AniList favourites`,
      url: `https://anilist.co/character/${c.id}`,
    }));
  });
}

/** A game's characters: the ones it lists, plus everything that says it appears in the game or its series. */
export function gameCharacters(qid: string): Promise<CharacterResult[]> {
  return cached(`game-chars:${qid}`, DAY, async () => {
    const work = await wikidata<{ entities?: Record<string, WikidataEntity> }>({ action: "wbgetentities", ids: qid, props: "claims" });
    const claims = work.entities?.[qid]?.claims ?? {};
    const valueIds = (property: string) =>
      (claims[property] ?? []).map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id).filter((id): id is string => Boolean(id));
    const search = async (statement: string, limit = 150) => {
      const found: string[] = [];
      for (let offset = 0; offset < limit; offset += 50) {
        const page = await wikidata<{ query?: { search?: { title: string }[] } }>({
          action: "query", list: "search", srsearch: `haswbstatement:${statement}`, srlimit: "50", sroffset: String(offset),
        });
        const hits = page.query?.search ?? [];
        found.push(...hits.map((hit) => hit.title));
        if (hits.length < 50) break;
      }
      return found;
    };
    // Characters usually name each game they appear in, not the series, so a series also
    // searches its member games; a shared fictional universe catches the rest.
    const memberGames = await search(`P179=${qid}`, 50);
    const works = [...new Set([qid, ...valueIds("P179"), ...memberGames])].slice(0, 40);
    const statements = [...works.map((id) => `P1441=${id}`), ...valueIds("P1080").map((id) => `P1080=${id}`)];
    const ids = new Set([...valueIds("P674"), ...(await search(statements.join("|")))]);
    const all = [...ids].slice(0, 150);
    const entities: WikidataEntity[] = [];
    for (let i = 0; i < all.length; i += 50) {
      const batch = await wikidata<{ entities?: Record<string, WikidataEntity> }>({
        action: "wbgetentities", ids: all.slice(i, i + 50).join("|"), props: "labels|descriptions|sitelinks|claims", languages: "en",
      });
      entities.push(...Object.values(batch.entities ?? {}));
    }
    return pickWikidataCharacters(entities);
  });
}
