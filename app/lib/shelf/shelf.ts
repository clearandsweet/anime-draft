/**
 * Turns someone's whole list into a shelf: every franchise (entries sharing the same characters) at
 * their highest score in it, its cast, and the figures every shop catalog has for it.
 */
import { ratingKey } from "./characters.ts";
import { groupFranchises } from "./franchise.ts";
import { mfcLink } from "./links.ts";
import { castNames, searchTerms } from "./match.ts";
import { bestFirst, mergeOffers } from "./merge.ts";
import { DEFAULT_SETTINGS, scoreFigure, type ScorableFigure, type ShelfCharacter, type ShelfSettings } from "./score.ts";
import { matchShop, type ShopCatalog } from "./shops.ts";
import { matchSolaris, solarisImage, solarisOffers, type SolarisCatalog } from "./solaris.ts";
import type { Availability, CastMember, Devotion, Offer, ScoredFigure, ShelfFigure, ShelfShow } from "./types.ts";

export { mfcLink } from "./links.ts";

export type SeedFigure = ScorableFigure & {
  name: string;
  line: string;
  maker: string;
  year?: number;
  cond?: string;
  where?: string;
  url?: string;
  mfcUrl?: string;
  mfcQuery?: string;
  avail?: string;
  note?: string;
  /** A photo of the same figure from a shop listing that's no longer for sale. */
  img?: string;
};

/** The hand-researched figures from the original Figure Shelf, with real MFC ratings. */
export type ShelfSeed = {
  pricesCheckedOn: string;
  shows: Record<string, { name: string; anchor: number }>;
  chars: Record<string, { name: string; show: string; rank?: number | null; malFav?: number }>;
  figures: Record<string, SeedFigure>;
};

export type ShelfCatalog = {
  generatedAt: string;
  shows: Record<string, {
    topFav: number | null;
    members: { id: number; idMal: number | null; title: string; format: string | null; year: number | null }[];
  }>;
  chars: Record<string, { anilistId: number; name: string; fav: number }>;
};

export type ListCharacter = {
  id: number;
  full: string;
  first: string | null;
  last: string | null;
  alternative: string[];
  favourites: number;
};

export type ListMedia = {
  id: number;
  idMal: number | null;
  format: string | null;
  year: number | null;
  popularity: number;
  title: { english: string | null; romaji: string | null; native: string | null };
  synonyms: string[];
  image: string | null;
  /** Other anime it's tied to; titles let shops' listings for unlisted sequels and spin-offs be recognised. */
  relations: { type: string; id: number; english?: string | null; romaji?: string | null }[];
  /** AniList ids of the MAIN-role characters, which decide franchises. */
  main: number[];
  /** The most-favourited characters, with names for matching listings. */
  top: ListCharacter[];
};

export type ListEntry = {
  media: ListMedia;
  /** 0–100; 0 means not scored. */
  score: number;
  status: string | null;
  /** Times rewatched. */
  repeat?: number;
};

const CAST_SIZE = 20;
const SERIES_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
// Ties to anime that can share characters; adaptations and "other" links don't.
const RELATIVE_TYPES = new Set(["SEQUEL", "PREQUEL", "PARENT", "SIDE_STORY", "SUMMARY", "COMPILATION", "CONTAINS", "ALTERNATIVE", "SPIN_OFF", "CHARACTER"]);
const WATCHED = new Set(["COMPLETED", "CURRENT", "REPEATING"]);
const MAX_BOOST = 5;
const titleOf = (media: ListMedia) => media.title.english || media.title.romaji || "Untitled";

function describe(entries: ShelfShow["entries"], score: number) {
  const scored = entries.filter((entry) => entry.score > 0);
  if (!scored.length) return `On your list but not scored (${entries.map((e) => e.title).join(", ")}). Score it to get picks.`;
  if (entries.length === 1) return `Your score: ${score} (${entries[0].title}).`;
  const top = scored.filter((entry) => entry.score === score).map((entry) => entry.title);
  return `Your highest score in the franchise: ${score} (${top.join(", ")}). ${entries.length} entries on your list.`;
}

/** Up to five points for signs of devotion beyond the score; a favourite earns all five. */
export function devotionBoost(devotion: Devotion) {
  if (devotion.favourite) return MAX_BOOST;
  const rewatch = devotion.rewatches >= 2 ? 4 : devotion.rewatches === 1 ? 3 : 0;
  const depth = devotion.watched >= 6 ? 2 : devotion.watched >= 3 ? 1 : 0;
  return Math.min(MAX_BOOST, rewatch + depth);
}

export function describeDevotion(devotion: Devotion) {
  if (devotion.favourite) return "for a favourite of yours";
  const reasons = [
    devotion.rewatches ? `rewatching it${devotion.rewatches > 1 ? ` ${devotion.rewatches} times` : ""}` : "",
    devotion.watched >= 3 ? `watching ${devotion.watched} entries` : "",
  ].filter(Boolean);
  return reasons.length ? `for ${reasons.join(" and ")}` : "";
}

/** The entry a franchise is named after: its first series, else its first entry. */
function namesake(members: ListMedia[]) {
  const byYear = [...members].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.id - b.id);
  return byYear.find((media) => media.format && SERIES_FORMATS.has(media.format)) ?? byYear[0];
}

// Stock roles AniList shares between hundreds of shows; nobody sells a figure of the Narrator.
const GENERIC_ROLE = /^(narrator|announcer|narration|unknown|additional voices?)$/i;

function castOf(members: ListMedia[], scoreOf: Map<number, number>): CastMember[] {
  const byId = new Map<number, ListCharacter>();
  for (const character of members.flatMap((media) => media.top)) {
    if (GENERIC_ROLE.test(character.full.trim())) continue;
    const known = byId.get(character.id);
    if (!known || character.favourites > known.favourites) byId.set(character.id, character);
  }
  const top = [...byId.values()].sort((a, b) => b.favourites - a.favourites).slice(0, CAST_SIZE);
  const spellings = castNames(top.map((c) => ({ key: ratingKey("anilist", c.id), full: c.full, first: c.first, last: c.last, alternative: c.alternative })));
  // At least one favourite each, so popularity is always measured against the show's top character.
  return top.map((c, i) => ({ key: spellings[i].key, name: c.full, names: spellings[i].names, fav: Math.max(1, c.favourites), score: scoreOf.get(c.id) ?? 0 }));
}

export function buildShows(entries: ListEntry[], options: { favouriteAnime?: number[] } = {}): ShelfShow[] {
  const byId = new Map(entries.map((entry) => [entry.media.id, entry]));
  const favourites = new Set(options.favouriteAnime ?? []);
  // A character's score is the person's best among every entry that character is in, so someone
  // who only turns up in a weaker season scores lower, and a crossover lends its score both ways.
  const characterScore = new Map<number, number>();
  for (const entry of entries) {
    if (entry.score <= 0) continue;
    for (const id of new Set([...entry.media.main, ...entry.media.top.map((c) => c.id)])) {
      if (entry.score > (characterScore.get(id) ?? 0)) characterScore.set(id, entry.score);
    }
  }
  const groups = groupFranchises(entries.map(({ media }) => ({ id: media.id, relations: media.relations, cast: media.main })));
  return groups.map((group) => {
    const mine = group.ids.map((id) => byId.get(id)!).sort((a, b) => b.media.popularity - a.media.popularity);
    const members = mine.map((entry) => entry.media);
    const first = namesake(members);
    const score = Math.max(0, ...mine.map((entry) => entry.score));
    const listed = mine.map((entry) => ({ id: entry.media.id, title: titleOf(entry.media), score: entry.score, status: entry.status }));
    const devotion: Devotion = {
      favourite: members.some((media) => favourites.has(media.id)),
      rewatches: mine.reduce((sum, entry) => sum + (entry.repeat ?? 0), 0),
      watched: mine.filter((entry) => WATCHED.has(entry.status ?? "")).length,
    };
    const inGroup = new Set(group.ids);
    const relatives = new Map<number, { english: string | null; romaji: string | null }>();
    for (const media of members) {
      for (const relation of media.relations) {
        if (inGroup.has(relation.id) || !RELATIVE_TYPES.has(relation.type) || !(relation.english || relation.romaji)) continue;
        relatives.set(relation.id, { english: relation.english ?? null, romaji: relation.romaji ?? null });
      }
    }
    return {
      id: `a${group.ids[0]}`,
      name: titleOf(first),
      score,
      boost: devotionBoost(devotion),
      devotion,
      basis: describe(listed, score),
      entries: listed,
      anilistUrl: `https://anilist.co/anime/${first.id}`,
      image: first.image,
      popularity: Math.max(0, ...members.map((media) => media.popularity)),
      terms: searchTerms(members.map((media) => ({ english: media.title.english, romaji: media.title.romaji, synonyms: media.synonyms })), [...relatives.values()]),
      cast: castOf(members, characterScore),
    };
  }).sort((a, b) => b.score - a.score || b.popularity - a.popularity);
}

const SOLARIS_PRODUCT = /^https:\/\/solarisjapan\.com\/products\/([^/?#]+)/;

/**
 * The researched figures for shows the person has on their list, refreshed from the Solaris
 * catalog when the listing is still there. Adds any figure character missing from the show's cast.
 */
function seedFigures(shows: ShelfShow[], seed: ShelfSeed, catalog: ShelfCatalog, solaris: SolarisCatalog | null) {
  const showOf = new Map<number, ShelfShow>();
  for (const show of shows) for (const entry of show.entries) showOf.set(entry.id, show);
  const rows = new Map((solaris?.rows ?? []).map((row) => [row[0], row]));
  const used = new Set<string>();
  const figures: ShelfFigure[] = [];
  for (const [id, figure] of Object.entries(seed.figures)) {
    const members = catalog.shows[figure.show]?.members ?? [{ id: seed.shows[figure.show]?.anchor }];
    const show = members.map((member) => showOf.get(member.id)).find(Boolean);
    if (!show) continue;
    const chars = figure.chars.map((c) => {
      const known = catalog.chars[c];
      if (!known) return { key: `seed:${c}`, name: seed.chars[c]?.name ?? c };
      const key = ratingKey("anilist", known.anilistId);
      if (!show.cast.some((member) => member.key === key)) show.cast.push({ key, name: known.name, names: [], fav: known.fav, score: 0 });
      return { key, name: known.name };
    });
    const handle = figure.url?.match(SOLARIS_PRODUCT)?.[1];
    const row = handle ? rows.get(handle) : undefined;
    if (handle && row) used.add(handle);
    const link = mfcLink(figure);
    // Without a live listing, a researched figure counts as for sale only if a price was found,
    // and not when it was found on Solaris (whose current catalog no longer has it).
    const stillListed = figure.price && !/solaris/i.test(`${figure.url} ${figure.where}`) && !/sold out|no copies/i.test(figure.avail ?? "");
    const researched: Offer = {
      source: figure.where || "Researched",
      url: figure.url || link.href,
      price: figure.price ?? null,
      cond: figure.cond === "pre-owned" ? "pre-owned" : "new",
      avail: stillListed ? "in stock" : "sold out",
      note: figure.note || undefined,
    };
    const offers = row ? solarisOffers(row).sort(bestFirst) : [researched];
    figures.push({
      ...(offers[0] ?? researched),
      offers,
      id: `seed:${id}`,
      show: show.id,
      match: "cast",
      name: figure.name,
      line: figure.line,
      maker: figure.maker,
      tier: figure.tier,
      chars: chars.map((c) => c.key),
      charNames: chars.map((c) => c.name),
      img: (row && solaris ? solarisImage(solaris, row[2]) : null) ?? figure.img ?? null,
      mfcHref: link.href,
      mfcDirect: link.direct,
      mfcR: figure.mfcR ?? null,
      mfcN: figure.mfcN ?? null,
    });
  }
  return { figures, used };
}

// Big franchises match hundreds of listings; the page gets each show's best ones.
const KEEP_FOR_SALE = 40;
const KEEP_SOLD_OUT = 8;

export function buildShelf(options: {
  entries: ListEntry[];
  seed: ShelfSeed;
  catalog: ShelfCatalog;
  solaris: SolarisCatalog | null;
  shops?: ShopCatalog[];
  favouriteCharacters?: number[];
  favouriteAnime?: number[];
  ratings?: Record<string, number>;
}) {
  const shows = buildShows(options.entries, { favouriteAnime: options.favouriteAnime });
  const seeded = seedFigures(shows, options.seed, options.catalog, options.solaris);
  // An unscored show still gets figures of a character scored through another entry.
  const wanted = shows.filter((show) => show.score > 0 || show.cast.some((member) => member.score > 0));
  const found = [
    ...(options.solaris ? matchSolaris(options.solaris, wanted, seeded.used) : []),
    ...(options.shops ?? []).flatMap((shop) => matchShop(shop, wanted)),
  ];
  const merged = mergeOffers([...seeded.figures, ...found], shows);
  const byId = new Map(merged.map((figure) => [figure.id, figure]));
  const ranked = scoreShelf({ shows, figures: merged, favouriteCharacters: options.favouriteCharacters, ratings: options.ratings });
  const kept = new Map<string, { forSale: number; soldOut: number }>();
  const figures: ShelfFigure[] = [];
  for (const { id, show, avail } of ranked) {
    const count = kept.get(show) ?? { forSale: 0, soldOut: 0 };
    const soldOut = avail === "sold out";
    if (soldOut ? count.soldOut >= KEEP_SOLD_OUT : count.forSale >= KEEP_FOR_SALE) continue;
    if (soldOut) count.soldOut++; else count.forSale++;
    kept.set(show, count);
    figures.push(byId.get(id)!);
  }
  return { shows, figures, matched: found.length + seeded.figures.length, distinct: ranked.length };
}

export type ShelfResult = ReturnType<typeof buildShelf>;

const AVAILABILITY: Record<Availability, number> = { "in stock": 0, "pre-order": 1, "sold out": 2 };

/**
 * Scores figures for the person: their show scores, the entries each character is in, signs of
 * devotion, favourite characters and their own character ratings. Best first; ties go to what's
 * in stock, then to the lower price.
 */
export function scoreShelf(options: {
  shows: ShelfShow[];
  figures: ShelfFigure[];
  favouriteCharacters?: number[];
  ratings?: Record<string, number>;
  settings?: ShelfSettings;
}): ScoredFigure[] {
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const favourites = new Set((options.favouriteCharacters ?? []).map((id) => ratingKey("anilist", id)));
  const ratings = options.ratings ?? {};
  // A figure's characters all come from its own show's cast, and popularity only compares
  // characters within a show, so each figure is scored against just that show's cast.
  const byShow = new Map<string, { show: ShelfShow; chars: Record<string, ShelfCharacter>; devotion: { boost: number; how: string } }>();
  for (const show of options.shows) {
    const chars: Record<string, ShelfCharacter> = {};
    for (const member of show.cast) {
      chars[member.key] = {
        show: show.id,
        name: member.name,
        fav: member.fav,
        favourite: favourites.has(member.key),
        rating: ratings[member.key] ?? null,
        score: member.score,
      };
    }
    byShow.set(show.id, { show, chars, devotion: { boost: show.boost, how: describeDevotion(show.devotion) } });
  }
  return options.figures
    .flatMap((figure) => {
      const own = byShow.get(figure.show);
      if (!own) return [];
      const result = scoreFigure(figure, own.show.score, own.chars, settings, own.devotion);
      return result.excluded ? [] : [{ ...figure, result }];
    })
    .sort((a, b) =>
      b.result.overall - a.result.overall ||
      AVAILABILITY[a.avail] - AVAILABILITY[b.avail] ||
      (a.result.price ?? Infinity) - (b.result.price ?? Infinity));
}
