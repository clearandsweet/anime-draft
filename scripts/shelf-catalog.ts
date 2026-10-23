/**
 * Builds app/lib/shelf/catalog.json from seed.json: for each shelf show, every AniList entry in
 * its franchise (same characters) with MAL ids, and each figure character's AniList id and
 * favourite count. Run with `npm run shelf:catalog`; it stays under AniList's rate limit.
 * Fetched entries are cached in node_modules/.cache (`--refresh` ignores the cache);
 * `--only <show>` prints how one show's franchise was grouped and writes nothing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { groupFranchises, type FranchiseMedia } from "../app/lib/shelf/franchise.ts";

type Seed = {
  shows: Record<string, { name: string; anchor: number }>;
  chars: Record<string, { name: string; show: string }>;
};
type Media = FranchiseMedia & {
  idMal: number | null;
  title: string;
  format: string | null;
  year: number | null;
};

const SEED = new URL("../app/lib/shelf/seed.json", import.meta.url);
const OUT = new URL("../app/lib/shelf/catalog.json", import.meta.url);
const CACHE = new URL("../node_modules/.cache/shelf-anilist.json", import.meta.url);
const seed: Seed = JSON.parse(readFileSync(SEED, "utf8"));
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const refresh = args.includes("--refresh");

const MEDIA_QUERY = `query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id idMal title { english romaji } format seasonYear
      relations { edges { relationType node { id type } } }
      characters(role: MAIN, perPage: 25) { nodes { id } }
    }
  }
}`;
const CAST_QUERY = `query ($id: Int) {
  Media(id: $id) {
    characters(sort: FAVOURITES_DESC, perPage: 25) { nodes { id name { full alternative } favourites } }
  }
}`;
const SEARCH_QUERY = `query ($search: String) {
  Character(search: $search) { id name { full } favourites }
}`;

let last = 0;
async function anilist<T>(query: string, variables: object): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    // AniList allows 30 requests a minute while degraded.
    const wait = last + 2100 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After")) || 60;
      console.warn(`rate limited, waiting ${seconds}s`);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }
    const payload = await response.json();
    if (!response.ok || payload.errors?.length) {
      throw new Error(`AniList ${response.status}: ${JSON.stringify(payload.errors ?? payload).slice(0, 300)}`);
    }
    return payload.data as T;
  }
  throw new Error("AniList kept rate limiting");
}

type RawMedia = {
  id: number;
  idMal: number | null;
  title: { english: string | null; romaji: string };
  format: string | null;
  seasonYear: number | null;
  relations: { edges: { relationType: string; node: { id: number; type: string } }[] };
  characters: { nodes: { id: number }[] };
};
type RawCharacter = { id: number; name: { full: string; alternative?: string[] | null }; favourites: number };

const fetched = new Map<number, Media>(
  refresh || !existsSync(CACHE) ? [] : JSON.parse(readFileSync(CACHE, "utf8"))
);
function saveCache() {
  mkdirSync(new URL(".", CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify([...fetched]));
}
async function fetchMedia(ids: number[]) {
  const missing = [...new Set(ids)].filter((id) => !fetched.has(id));
  for (let i = 0; i < missing.length; i += 50) {
    const data = await anilist<{ Page: { media: RawMedia[] } }>(MEDIA_QUERY, { ids: missing.slice(i, i + 50) });
    for (const m of data.Page.media) {
      fetched.set(m.id, {
        id: m.id,
        idMal: m.idMal ?? null,
        title: m.title.english || m.title.romaji,
        format: m.format ?? null,
        year: m.seasonYear ?? null,
        relations: m.relations.edges
          .filter((edge) => edge.node.type === "ANIME")
          .map((edge) => ({ type: edge.relationType, id: edge.node.id })),
        cast: m.characters.nodes.map((node) => node.id),
      });
    }
    saveCache();
  }
}

/** Grows the franchise around the anchor one ring of relations at a time. */
async function franchiseOf(anchor: number) {
  const seen = new Set([anchor]);
  let frontier = [anchor];
  let members = [anchor];
  let local: Media[] = [];
  for (let round = 0; round < 8 && frontier.length; round++) {
    await fetchMedia(frontier);
    local = [...seen].map((id) => fetched.get(id)).filter((m): m is Media => Boolean(m));
    const group = groupFranchises(local).find((g) => g.ids.includes(anchor))!;
    members = group.ids;
    frontier = members
      .flatMap((id) => fetched.get(id)?.relations.map((r) => r.id) ?? [])
      .filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
  }
  if (only) {
    for (const group of groupFranchises(local).sort((a, b) => b.ids.length - a.ids.length)) {
      const label = group.ids.includes(anchor) ? "FRANCHISE" : group.crossover ? "crossover" : "other";
      console.log(`${label}: ${group.ids.map((id) => `${id} ${fetched.get(id)!.title} [${fetched.get(id)!.cast.length}]`).join(" | ")}`);
    }
  }
  return members.map((id) => fetched.get(id)!);
}

const simplify = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").replace(/ou/g, "o").replace(/uu/g, "u")
    .split(/\s+/).filter(Boolean).sort().join(" ");

const shows: Record<string, unknown> = {};
const chars: Record<string, { anilistId: number; name: string; fav: number }> = {};
for (const [showId, show] of Object.entries(seed.shows).filter(([id]) => !only || id === only)) {
  const members = await franchiseOf(show.anchor);
  if (only) continue;
  const cast = await anilist<{ Media: { characters: { nodes: RawCharacter[] } } }>(CAST_QUERY, { id: show.anchor });
  const nodes = cast.Media.characters.nodes;
  shows[showId] = {
    topFav: nodes[0]?.favourites ?? null,
    members: members
      .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.id - b.id)
      .map(({ id, idMal, title, format, year }) => ({ id, idMal, title, format, year })),
  };
  for (const [charId, char] of Object.entries(seed.chars).filter(([, c]) => c.show === showId)) {
    const wanted = simplify(char.name);
    let match = nodes.find((node) =>
      [node.name.full, ...(node.name.alternative ?? [])].some((name) => name && simplify(name) === wanted));
    if (!match) {
      match = (await anilist<{ Character: RawCharacter }>(SEARCH_QUERY, { search: char.name })).Character;
      console.warn(`${charId}: not in ${show.name}'s top 25, search found ${match?.name.full}`);
    }
    chars[charId] = { anilistId: match.id, name: match.name.full, fav: match.favourites };
  }
  console.log(`${showId}: ${members.length} entries — ${members.map((m) => m.title).join(" · ").slice(0, 160)}`);
}

if (!only) {
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), shows, chars }, null, 1) + "\n");
  console.log(`wrote ${Object.keys(shows).length} shows, ${Object.keys(chars).length} characters`);
}
