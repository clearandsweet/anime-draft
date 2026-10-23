/**
 * Turns someone's whole list into a shelf: every franchise (entries sharing the same characters) at
 * their highest score in it, its cast, and the figures found for it so far.
 */
import { ratingKey } from "./characters.ts";
import { groupFranchises } from "./franchise.ts";
import { mfcLink } from "./links.ts";
import { castNames, searchTerms } from "./match.ts";
import { DEFAULT_SETTINGS, scoreFigure, type ScorableFigure, type ShelfCharacter, type ShelfSettings } from "./score.ts";
import { matchSolaris, solarisImage, type SolarisCatalog } from "./solaris.ts";
import type { CastMember, ScoredFigure, ShelfFigure, ShelfShow } from "./types.ts";

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
  relations: { type: string; id: number }[];
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
};

const CAST_SIZE = 16;
const SERIES_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
const titleOf = (media: ListMedia) => media.title.english || media.title.romaji || "Untitled";

function describe(entries: ShelfShow["entries"], score: number) {
  const scored = entries.filter((entry) => entry.score > 0);
  if (!scored.length) return `On your list but not scored (${entries.map((e) => e.title).join(", ")}). Score it to get picks.`;
  if (entries.length === 1) return `Your score: ${score} (${entries[0].title}).`;
  const top = scored.filter((entry) => entry.score === score).map((entry) => entry.title);
  return `Your highest score in the franchise: ${score} (${top.join(", ")}). ${entries.length} entries on your list.`;
}

/** The entry a franchise is named after: its first series, else its first entry. */
function namesake(members: ListMedia[]) {
  const byYear = [...members].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.id - b.id);
  return byYear.find((media) => media.format && SERIES_FORMATS.has(media.format)) ?? byYear[0];
}

function castOf(members: ListMedia[]): CastMember[] {
  const byId = new Map<number, ListCharacter>();
  for (const character of members.flatMap((media) => media.top)) {
    const known = byId.get(character.id);
    if (!known || character.favourites > known.favourites) byId.set(character.id, character);
  }
  const top = [...byId.values()].sort((a, b) => b.favourites - a.favourites).slice(0, CAST_SIZE);
  const spellings = castNames(top.map((c) => ({ key: ratingKey("anilist", c.id), full: c.full, first: c.first, last: c.last, alternative: c.alternative })));
  return top.map((c, i) => ({ key: spellings[i].key, name: c.full, names: spellings[i].names, fav: c.favourites }));
}

export function buildShows(entries: ListEntry[]): ShelfShow[] {
  const byId = new Map(entries.map((entry) => [entry.media.id, entry]));
  const groups = groupFranchises(entries.map(({ media }) => ({ id: media.id, relations: media.relations, cast: media.main })));
  return groups.map((group) => {
    const mine = group.ids.map((id) => byId.get(id)!).sort((a, b) => b.media.popularity - a.media.popularity);
    const members = mine.map((entry) => entry.media);
    const first = namesake(members);
    const score = Math.max(0, ...mine.map((entry) => entry.score));
    const listed = mine.map((entry) => ({ id: entry.media.id, title: titleOf(entry.media), score: entry.score, status: entry.status }));
    return {
      id: `a${group.ids[0]}`,
      name: titleOf(first),
      score,
      basis: describe(listed, score),
      entries: listed,
      anilistUrl: `https://anilist.co/anime/${first.id}`,
      image: first.image,
      popularity: Math.max(0, ...members.map((media) => media.popularity)),
      terms: searchTerms(members.map((media) => ({ english: media.title.english, romaji: media.title.romaji, synonyms: media.synonyms }))),
      cast: castOf(members),
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
      if (!show.cast.some((member) => member.key === key)) show.cast.push({ key, name: known.name, names: [], fav: known.fav });
      return { key, name: known.name };
    });
    const handle = figure.url?.match(SOLARIS_PRODUCT)?.[1];
    const row = handle ? rows.get(handle) : undefined;
    if (handle && row) used.add(handle);
    const link = mfcLink(figure);
    // The catalog's current offer: the cheaper of new and pre-owned that's for sale.
    const offers = row ? [
      { price: row[3], stock: row[4], cond: "new" as const },
      { price: row[5], stock: row[6], cond: "pre-owned" as const },
    ].filter((offer) => offer.price > 0 && offer.stock).sort((a, b) => a.price - b.price) : [];
    const live = row && solaris ? {
      price: offers[0]?.price ?? figure.price ?? null,
      cond: offers[0]?.cond,
      avail: (!offers.length ? "sold out" : offers[0].stock === 2 ? "pre-order" : "in stock") as ShelfFigure["avail"],
      img: solarisImage(solaris, row[2]),
    } : null;
    figures.push({
      id: `seed:${id}`,
      show: show.id,
      name: figure.name,
      line: figure.line,
      maker: figure.maker,
      tier: figure.tier,
      chars: chars.map((c) => c.key),
      charNames: chars.map((c) => c.name),
      price: live?.price ?? figure.price ?? null,
      cond: live?.cond ?? (figure.cond === "pre-owned" ? "pre-owned" : "new"),
      // Without a live listing, a researched figure counts as for sale only if a price was found,
      // and not when it was found on Solaris (whose current catalog no longer has it).
      avail: live?.avail ?? (figure.price && !/solaris/i.test(`${figure.url} ${figure.where}`) && !/sold out|no copies/i.test(figure.avail ?? "") ? "in stock" : "sold out"),
      source: figure.where || "Researched",
      url: figure.url || link.href,
      img: live?.img ?? figure.img ?? null,
      mfcHref: link.href,
      mfcDirect: link.direct,
      mfcR: figure.mfcR ?? null,
      mfcN: figure.mfcN ?? null,
      note: figure.note || undefined,
    });
  }
  return { figures, used };
}

// Big franchises match hundreds of listings; the page gets each show's best ones.
const KEEP_FOR_SALE = 60;
const KEEP_SOLD_OUT = 15;

export function buildShelf(options: {
  entries: ListEntry[];
  seed: ShelfSeed;
  catalog: ShelfCatalog;
  solaris: SolarisCatalog | null;
  favouriteCharacters?: number[];
  ratings?: Record<string, number>;
}) {
  const shows = buildShows(options.entries);
  const seeded = seedFigures(shows, options.seed, options.catalog, options.solaris);
  const scored = shows.filter((show) => show.score > 0);
  const found = options.solaris ? matchSolaris(options.solaris, scored, seeded.used) : [];
  const all = [...seeded.figures, ...found];
  const byId = new Map(all.map((figure) => [figure.id, figure]));
  const ranked = scoreShelf({ shows, figures: all, favouriteCharacters: options.favouriteCharacters, ratings: options.ratings });
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
  return { shows, figures, matched: ranked.length };
}

export type ShelfResult = ReturnType<typeof buildShelf>;

/** Scores figures for the person: their show scores, favourite characters and their own character ratings. */
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
  const castOf = new Map<string, Record<string, ShelfCharacter>>();
  const scoreOf = new Map<string, number>();
  for (const show of options.shows) {
    scoreOf.set(show.id, show.score);
    const chars: Record<string, ShelfCharacter> = {};
    for (const member of show.cast) {
      chars[member.key] = {
        show: show.id,
        name: member.name,
        fav: member.fav,
        favourite: favourites.has(member.key),
        rating: ratings[member.key] ?? null,
      };
    }
    castOf.set(show.id, chars);
  }
  return options.figures
    .map((figure) => ({ ...figure, result: scoreFigure(figure, scoreOf.get(figure.show), castOf.get(figure.show) ?? {}, settings) }))
    .filter((figure) => !figure.result.excluded)
    .sort((a, b) => b.result.overall - a.result.overall);
}
