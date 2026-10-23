/** Figure Shelf scoring, ported unchanged from the Figure Shelf Score artifact. */
export type Tier = "A" | "B" | "C" | "D" | "E";

export const TIERS: Record<Tier, { label: string; group: TypeGroup }> = {
  A: { label: "Premium scale", group: "scale" },
  B: { label: "Scale", group: "scale" },
  C: { label: "Nendoroid / figma", group: "articulated" },
  D: { label: "Pop Up Parade class", group: "nonscale" },
  E: { label: "Prize", group: "prize" },
};

export type TypeGroup = "scale" | "articulated" | "nonscale" | "prize";

export type ShelfSettings = {
  wShow: number;
  wQuality: number;
  wPop: number;
  /** Ratings a figure needs before its own MFC score counts as much as the line average. */
  C: number;
  valueMode: "log" | "sqrt";
  priors: Record<Tier, number>;
  /** Popularity by estimated rank when favourite counts are missing: #1, #2, #3, #4+. */
  rankPop: number[];
};

export const DEFAULT_SETTINGS: ShelfSettings = {
  wShow: 35,
  wQuality: 40,
  wPop: 25,
  C: 50,
  valueMode: "log",
  priors: { A: 9.1, B: 8.9, C: 8.6, D: 8.3, E: 7.9 },
  rankPop: [1, 0.75, 0.55, 0.4],
};

export type ShelfCharacter = {
  show: string;
  name?: string;
  /** Favourite count on the list site; used when every character in the show has one. */
  fav?: number | null;
  /** Favourites of the franchise's most-favourited character, when known beyond this list. */
  topFav?: number | null;
  rank?: number | null;
  /** The viewer marked this character as a favourite. */
  favourite?: boolean;
  /** The viewer's own rating, 1–10; it replaces every other popularity signal. */
  rating?: number | null;
};

export type ScorableFigure = {
  show: string;
  chars: string[];
  tier: Tier;
  mfcR?: number | null;
  mfcN?: number | null;
  price?: number | null;
};

export type Popularity = { value: number; how: string };

export type FigureScore = {
  showScore: number;
  prior: number;
  quality: number;
  qualityScaled: number;
  realRating: boolean;
  popularity: Popularity;
  popularChar: string | null;
  parts: { show: number; quality: number; popularity: number };
  overall: number;
  value: number | null;
  price: number | null;
  excluded: boolean;
};

const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function characterPopularity(
  charId: string,
  chars: Record<string, ShelfCharacter>,
  settings: ShelfSettings = DEFAULT_SETTINGS
): Popularity {
  const char = chars[charId];
  const ranks = settings.rankPop.length ? settings.rankPop : DEFAULT_SETTINGS.rankPop;
  if (!char) return { value: ranks[ranks.length - 1], how: "unknown character" };
  const rating = finite(char.rating);
  if (rating !== null) return { value: Math.max(0, Math.min(10, rating)) / 10, how: `your rating ${rating}/10` };
  if (char.favourite) return { value: 1, how: "one of your favourite characters" };
  const sameShow = Object.values(chars).filter((other) => other.show === char.show);
  if (sameShow.length && sameShow.every((other) => (finite(other.fav) ?? 0) > 0)) {
    const top = Math.max(char.topFav ?? 0, ...sameShow.map((other) => other.fav as number));
    return {
      value: Math.sqrt((char.fav as number) / top),
      how: `${(char.fav as number).toLocaleString("en-US")} favourites vs ${top.toLocaleString("en-US")} for the show's top character`,
    };
  }
  const rank = Math.max(1, Math.min(char.rank || ranks.length, ranks.length));
  return { value: ranks[rank - 1], how: `estimated #${char.rank || "?"} in the show` };
}

export function scoreFigure(
  figure: ScorableFigure,
  showScore: number | null | undefined,
  chars: Record<string, ShelfCharacter>,
  settings: ShelfSettings = DEFAULT_SETTINGS
): FigureScore {
  const score = Math.max(0, Math.min(100, Number(showScore) || 0));
  const prior = finite(settings.priors[figure.tier]) ?? 8.6;
  const C = Math.max(0, finite(settings.C) ?? 50);
  const R = finite(figure.mfcR);
  const n = finite(figure.mfcN);
  const realRating = R !== null && n !== null && n > 0;
  const quality = realRating ? (n * R + C * prior) / (n + C) : prior;
  const qualityScaled = Math.max(0, Math.min(1, (quality - 7) / 3));

  let popularity: Popularity = { value: 0, how: "" };
  let popularChar: string | null = null;
  for (const charId of figure.chars ?? []) {
    const candidate = characterPopularity(charId, chars, settings);
    if (candidate.value > popularity.value) {
      popularity = candidate;
      popularChar = charId;
    }
  }

  const weights = settings.wShow + settings.wQuality + settings.wPop || 1;
  const parts = {
    show: (100 * settings.wShow * (score / 100)) / weights,
    quality: (100 * settings.wQuality * qualityScaled) / weights,
    popularity: (100 * settings.wPop * popularity.value) / weights,
  };
  const overall = parts.show + parts.quality + parts.popularity;
  const price = finite(figure.price);
  let value: number | null = null;
  if (price && price > 0) {
    value =
      settings.valueMode === "sqrt"
        ? (overall / Math.sqrt(price)) * 10
        : overall / Math.log10(Math.max(price, 10));
  }
  return {
    showScore: score,
    prior,
    quality,
    qualityScaled,
    realRating,
    popularity,
    popularChar,
    parts,
    overall,
    value,
    price,
    excluded: score <= 0,
  };
}
