/** Shapes shared by the shelf's server routes and the page. */
import type { FigureScore, Tier } from "./score.ts";

export type Condition = "new" | "pre-owned";
export type Availability = "in stock" | "pre-order" | "sold out";

/**
 * How a listing belongs to a franchise: it shows a character from the cast; it's from the show
 * but shows someone else (a minor character, a set); or it's from a related series the person
 * hasn't listed.
 */
export type MatchKind = "cast" | "series" | "related";

/** One shop's price for a figure. */
export type Offer = {
  source: string;
  url: string;
  /** US dollars; converted from yen for Japanese shops. */
  price: number | null;
  /** The shop's own price when it isn't in dollars ("¥7,980"). */
  priceLabel?: string;
  cond: Condition;
  avail: Availability;
  note?: string;
};

/** A figure attached to one of the person's franchises, with the best offer found for it. */
export type ShelfFigure = Offer & {
  /** "solaris:<handle>", "animota:<handle>", "ebay:<item>" or "seed:<key>". */
  id: string;
  /** The franchise (ShelfShow id) it belongs to. */
  show: string;
  match?: MatchKind;
  name: string;
  line: string;
  maker: string;
  tier: Tier;
  /** Moves the class's usual rating: below it for budget makers. */
  qAdj?: number;
  /** Character keys ("anilist:38005"); "unknown" when the listing names nobody in the cast. */
  chars: string[];
  charNames: string[];
  img: string | null;
  mfcHref: string;
  mfcDirect: boolean;
  mfcR?: number | null;
  mfcN?: number | null;
  nsfw?: boolean;
  /** JAN/EAN barcode, the same in every shop. */
  jan?: string;
  /** Every shop's price when more than one sells it, best first. */
  offers?: Offer[];
};

export type ScoredFigure = ShelfFigure & { result: FigureScore };

export type CastMember = {
  key: string;
  name: string;
  /** Normalized spellings to look for in listings: the full name, alternatives, and a distinctive given or family name. */
  names: string[];
  fav: number;
  /** The person's best score among their entries this character appears in, on any franchise; 0 when none is scored. */
  score: number;
};

export type SearchTerms = {
  /** What to type into a shop's search box, most useful first. */
  queries: string[];
  /** The romaji version, tried when the English queries find nothing. */
  altQueries: string[];
  /** Whole titles (without season markers): a listing under one of these belongs to the franchise. */
  exact: string[];
  /** Titles without their subtitle: a listing under one of these also needs a character from the cast. */
  loose: string[];
  /** Titles of sequels, spin-offs and crossovers that aren't on the list. Used on the server only. */
  related: string[];
};

/** Signals beyond the score that someone loves a franchise. */
export type Devotion = { favourite: boolean; rewatches: number; watched: number };

/** One franchise on the person's list: every entry that shares the same characters. */
export type ShelfShow = {
  id: string;
  name: string;
  /** Their highest score for any entry, 0–100. */
  score: number;
  /** Points added for rewatching, favouriting or following the franchise through several entries. */
  boost: number;
  devotion: Devotion;
  basis: string;
  entries: { id: number; title: string; score: number; status: string | null }[];
  anilistUrl: string;
  image: string | null;
  popularity: number;
  terms: SearchTerms;
  cast: CastMember[];
};

/** The part of a show a shop search needs, as the page sends it back. */
export type CatalogShow = Pick<ShelfShow, "id" | "score" | "terms" | "cast">;
