/** Character lookup for rating: the five most popular characters of a show (AniList) or game (Wikidata). */
export type CharacterSource = "anilist" | "wikidata";

export type WorkResult = {
  source: CharacterSource;
  id: string;
  title: string;
  subtitle: string;
  image: string | null;
};

export type CharacterResult = {
  key: string;
  name: string;
  image: string | null;
  /** What popular means for this source: AniList favourites, or wikis covering the character. */
  popularity: number;
  popularityLabel: string;
  url: string;
};

export const RATING_MIN = 1;
export const RATING_MAX = 10;

export function ratingKey(source: CharacterSource, id: string | number) {
  return `${source}:${id}`;
}

/** Keeps only well-formed ratings: known sources, whole numbers 1–10, at most 500 of them. */
export function cleanRatings(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 500)) {
    if (!/^(anilist:\d{1,9}|wikidata:Q\d{1,12})$/.test(key)) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < RATING_MIN || value > RATING_MAX) continue;
    out[key] = value;
  }
  return out;
}

// What links to a game is mostly its cast, plus its places, weapons and songs. Anything not
// described as one of those stays, since many characters have no description at all.
const CHARACTER_WORDS = /\b(character|protagonist|antagonist|heroine|villain|deuteragonist)\b/i;
const NOT_A_PERSON = /\bcharacter (set|class|encoding|creator|design)\b/i;
const PLACE_OR_THING =
  /\b(location|place|city|city-state|town|village|country|nation|region|realm|setting|continent|planet|island|weapon|sword|item|object|song|album|soundtrack|organi[sz]ation|faction|company|vehicle|building|language|species|spell|mythology|game|series|episode|colou?r|trope|concept|term|technique)\b/i;
// Fictional character, fictional human, video game character, anime/manga character and kin.
const FICTIONAL_CHARACTER_CLASSES = new Set([
  "Q95074", "Q15632617", "Q15773347", "Q1114461", "Q15711870", "Q4271324", "Q21070568", "Q15773317", "Q1569167", "Q80447738",
]);

export type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  sitelinks?: Record<string, unknown>;
  claims?: Record<string, { mainsnak: { datavalue?: { value?: unknown } } }[]>;
};

function claimIds(entity: WikidataEntity, property: string) {
  return (entity.claims?.[property] ?? [])
    .map((claim) => (claim.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((id): id is string => Boolean(id));
}

/** Characters among a work's linked entities: known characters first, then by wiki coverage. */
export function pickWikidataCharacters(entities: WikidataEntity[], limit = 5): CharacterResult[] {
  return entities
    .flatMap((entity) => {
      const name = entity.labels?.en?.value;
      if (!name) return [];
      const description = entity.descriptions?.en?.value ?? "";
      const typed = claimIds(entity, "P31").some((id) => FICTIONAL_CHARACTER_CLASSES.has(id));
      const described = CHARACTER_WORDS.test(description) && !NOT_A_PERSON.test(description);
      if (!typed && !described && (NOT_A_PERSON.test(description) || PLACE_OR_THING.test(description))) return [];
      const links = Object.keys(entity.sitelinks ?? {}).length;
      const image = (entity.claims?.P18?.[0]?.mainsnak.datavalue?.value as string | undefined) ?? null;
      return [{
        sure: typed || described,
        result: {
          key: ratingKey("wikidata", entity.id),
          name,
          image: image ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image)}?width=240` : null,
          popularity: links,
          popularityLabel: `${links} wiki${links === 1 ? "" : "s"}`,
          url: `https://www.wikidata.org/wiki/${entity.id}`,
        },
      }];
    })
    .sort((a, b) => Number(b.sure) - Number(a.sure) || b.result.popularity - a.result.popularity || a.result.name.localeCompare(b.result.name))
    .slice(0, limit)
    .map((pick) => pick.result);
}

/** Games first among Wikidata search hits; everything else stays pickable below them. */
export function rankWikidataWorks(hits: { id: string; label?: string; description?: string }[]): WorkResult[] {
  const gameish = (description = "") => /\bgames?\b|visual novel|franchise|doujin/i.test(description);
  return hits
    .filter((hit) => hit.label)
    .sort((a, b) => Number(gameish(b.description)) - Number(gameish(a.description)))
    .map((hit) => ({ source: "wikidata", id: hit.id, title: hit.label!, subtitle: hit.description ?? "", image: null }));
}
