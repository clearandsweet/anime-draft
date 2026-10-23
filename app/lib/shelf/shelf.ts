/** Turns someone's list into ranked figures: each shelf show takes their highest score in its franchise. */
import { ratingKey } from "./characters.ts";
import { DEFAULT_SETTINGS, scoreFigure, type FigureScore, type ScorableFigure, type ShelfCharacter, type ShelfSettings } from "./score.ts";

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
};

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

export type ListEntry = {
  anilistId: number | null;
  malId: number | null;
  /** 0–100; 0 means not scored. */
  score: number;
  status: string | null;
  title: string;
};

export type ShelfShow = {
  id: string;
  name: string;
  /** The AniList entry the shelf researched this show from. */
  anchor: number;
  score: number;
  basis: string;
  entries: { title: string; score: number; status: string | null }[];
  anilistUrl: string;
};

export type ShelfFigure = SeedFigure & {
  id: string;
  charNames: string[];
  result: FigureScore;
  mfcHref: string;
  mfcDirect: boolean;
};

const MFC_ITEM = /^https:\/\/myfigurecollection\.net\/item\/\d+$/;

/** A known MFC item page, or MFC's quick search, which opens the item on a unique match. */
export function mfcLink(figure: Pick<SeedFigure, "name" | "url" | "mfcUrl" | "mfcQuery">) {
  const direct = [figure.mfcUrl, figure.url].find((url) => MFC_ITEM.test(url ?? ""));
  return direct
    ? { href: direct, direct: true }
    : { href: `https://myfigurecollection.net/?_tb=item&keywords=${encodeURIComponent(figure.mfcQuery || figure.name)}`, direct: false };
}

function describe(entries: ShelfShow["entries"], score: number) {
  if (!entries.length) return "Not on your list.";
  const scored = entries.filter((entry) => entry.score > 0);
  if (!scored.length) return `On your list but not scored (${entries.map((e) => e.title).join(", ")}).`;
  if (entries.length === 1) return `Your score: ${score} (${entries[0].title}).`;
  const top = scored.filter((entry) => entry.score === score).map((entry) => entry.title);
  return `Your highest score in the franchise: ${score} (${top.join(", ")}). ${entries.length} entries on your list.`;
}

export function buildShelf(options: {
  seed: ShelfSeed;
  catalog: ShelfCatalog | null;
  entries: ListEntry[];
  /** AniList character ids the person has favourited. */
  favouriteCharacters?: number[];
  /** The person's own 1–10 character ratings, keyed like "anilist:38005". */
  ratings?: Record<string, number>;
  settings?: ShelfSettings;
}) {
  const { seed, catalog, entries } = options;
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const favourites = new Set(options.favouriteCharacters ?? []);
  const ratings = options.ratings ?? {};

  const shows: ShelfShow[] = Object.entries(seed.shows).map(([id, show]) => {
    const members = catalog?.shows[id]?.members ?? [{ id: show.anchor, idMal: null }];
    const anilistIds = new Set(members.map((m) => m.id));
    const malIds = new Set(members.map((m) => m.idMal).filter(Boolean));
    const mine = entries
      .filter((e) => (e.anilistId && anilistIds.has(e.anilistId)) || (e.malId && malIds.has(e.malId)))
      .map(({ title, score, status }) => ({ title, score, status }));
    const score = Math.max(0, ...mine.map((e) => e.score));
    return { id, name: show.name, anchor: show.anchor, score, basis: describe(mine, score), entries: mine, anilistUrl: `https://anilist.co/anime/${show.anchor}` };
  });
  const scoreOf = new Map(shows.map((show) => [show.id, show.score]));

  const chars: Record<string, ShelfCharacter> = {};
  for (const [id, char] of Object.entries(seed.chars)) {
    const known = catalog?.chars[id];
    chars[id] = {
      show: char.show,
      name: known?.name ?? char.name,
      fav: known?.fav ?? char.malFav ?? null,
      topFav: known ? catalog?.shows[char.show]?.topFav ?? null : null,
      rank: char.rank ?? null,
      favourite: Boolean(known && favourites.has(known.anilistId)),
      rating: known ? ratings[ratingKey("anilist", known.anilistId)] ?? null : null,
    };
  }

  const figures: ShelfFigure[] = Object.entries(seed.figures).map(([id, figure]) => {
    const link = mfcLink(figure);
    return {
      ...figure,
      id,
      charNames: figure.chars.map((c) => chars[c]?.name ?? c),
      result: scoreFigure(figure, scoreOf.get(figure.show), chars, settings),
      mfcHref: link.href,
      mfcDirect: link.direct,
    };
  });

  return {
    shows: shows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    figures: figures.filter((f) => !f.result.excluded).sort((a, b) => b.result.overall - a.result.overall),
    pricesCheckedOn: seed.pricesCheckedOn,
    catalogDate: catalog?.generatedAt ?? null,
  };
}

export type ShelfResult = ReturnType<typeof buildShelf>;
