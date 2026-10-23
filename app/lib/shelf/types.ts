/** Shapes shared by the shelf's server routes and the page. */
import type { FigureScore, Tier } from "./score.ts";

export type Condition = "new" | "pre-owned";
export type Availability = "in stock" | "pre-order" | "sold out";

/** A figure for sale (or recently sold out) somewhere, attached to one of the person's franchises. */
export type ShelfFigure = {
  /** "solaris:<handle>", "amiami:<code>" or "seed:<key>". */
  id: string;
  /** The franchise (ShelfShow id) it belongs to. */
  show: string;
  name: string;
  line: string;
  maker: string;
  tier: Tier;
  /** Character keys ("anilist:38005"); "unknown" when the listing names nobody in the cast. */
  chars: string[];
  charNames: string[];
  /** US dollars; converted from yen for Japanese shops. */
  price: number | null;
  /** The shop's own price when it isn't in dollars ("¥7,980"). */
  priceLabel?: string;
  cond: Condition;
  avail: Availability;
  source: string;
  url: string;
  img: string | null;
  mfcHref: string;
  mfcDirect: boolean;
  mfcR?: number | null;
  mfcN?: number | null;
  nsfw?: boolean;
  note?: string;
};

export type ScoredFigure = ShelfFigure & { result: FigureScore };

export type CastMember = {
  key: string;
  name: string;
  /** Normalized spellings to look for in listings: the full name, alternatives, and a distinctive given or family name. */
  names: string[];
  fav: number;
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
};

/** One franchise on the person's list: every entry that shares the same characters. */
export type ShelfShow = {
  id: string;
  name: string;
  score: number;
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
