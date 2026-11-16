/** Folds listings of the same figure, from different shops or re-releases, into one card with every offer. */
import { identityKey, normalize } from "./match.ts";
import type { Availability, MatchKind, Offer, ShelfFigure, ShelfShow } from "./types.ts";

const AVAILABILITY: Record<Availability, number> = { "in stock": 0, "pre-order": 1, "sold out": 2 };
const KIND: Record<MatchKind, number> = { cast: 0, series: 1, related: 2 };
const MAX_OFFERS = 6;
const SPECIFIC = 5;

/** In stock before pre-order before sold out, then the lowest price. */
export const bestFirst = (a: Offer, b: Offer) =>
  AVAILABILITY[a.avail] - AVAILABILITY[b.avail] || (a.price ?? Infinity) - (b.price ?? Infinity);

const offerOf = (figure: ShelfFigure): Offer => ({
  source: figure.source,
  url: figure.url,
  price: figure.price,
  priceLabel: figure.priceLabel,
  cond: figure.cond,
  avail: figure.avail,
  note: figure.note,
});

// A key depends only on the listing and the show's titles, so keys are kept between requests:
// the same list, or the same show on someone else's, doesn't work them out again.
const keyCache = new Map<string, Map<string, string>>();
const KEY_CACHE_LIMIT = 150_000;
let cachedKeys = 0;

function keysFor(titles: string[]) {
  const signature = titles.join("|");
  let known = keyCache.get(signature);
  if (!known) {
    if (cachedKeys > KEY_CACHE_LIMIT) {
      keyCache.clear();
      cachedKeys = 0;
    }
    known = new Map();
    keyCache.set(signature, known);
  }
  const keys = known;
  return (name: string, maker: string) => {
    const id = `${maker}\n${name}`;
    let key = keys.get(id);
    if (key === undefined) {
      key = identityKey(name, titles, maker);
      keys.set(id, key);
      cachedKeys++;
    }
    return key;
  };
}

// A researched figure knows the most (an MFC page and rating); Solaris names its listings most cleanly.
const leadRank = (figure: ShelfFigure) => (figure.id.startsWith("seed:") ? 0 : figure.id.startsWith("solaris:") ? 1 : 2);

/**
 * Two listings are the same figure when they share a barcode, or when the same maker's listings
 * for the same show come down to the same words once the series title and filler are removed.
 */
export function mergeOffers(figures: ShelfFigure[], shows: Pick<ShelfShow, "id" | "terms">[]): ShelfFigure[] {
  const keyOf = new Map(shows.map((show) => [show.id, keysFor([...show.terms.exact, ...show.terms.loose, ...show.terms.related].sort((a, b) => b.length - a.length))]));
  const parent = figures.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map<string, number>();
  const join = (key: string, i: number) => {
    const first = seen.get(key);
    if (first === undefined) seen.set(key, i);
    else parent[find(i)] = find(first);
  };
  figures.forEach((figure, i) => {
    if (figure.jan) join(`jan:${figure.jan}`, i);
    const words = keyOf.get(figure.show)?.(figure.name, figure.maker) ?? identityKey(figure.name, [], figure.maker);
    if (!words) return;
    join(`${figure.show}|${normalize(figure.maker).split(" ")[0]}|${words}`, i);
    // Shops credit a figure to its maker, its brand or its distributor; a description this
    // specific ("Holo 1/7 Plentiful Apple Harvest") is the same sculpt whoever is named.
    if (words.split(" ").length >= SPECIFIC) join(`${figure.show}||${words}`, i);
  });

  const groups = new Map<number, ShelfFigure[]>();
  figures.forEach((figure, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(figure);
    else groups.set(root, [figure]);
  });

  return [...groups.values()].map((group) => {
    if (group.length === 1 && (group[0].offers?.length ?? 0) <= 1) return { ...group[0], offers: undefined };
    const lead = group.reduce((a, b) => (leadRank(b) < leadRank(a) ? b : a));
    const offers = group.flatMap((figure) => (figure.offers?.length ? figure.offers : [offerOf(figure)]));
    // A sold-out or unpriced line adds nothing once the figure can be bought somewhere.
    const buyable = offers.filter((offer) => offer.avail !== "sold out" && offer.price !== null);
    const listed = (buyable.length ? buyable : offers).sort(bestFirst).slice(0, MAX_OFFERS);
    const named = group.find((figure) => figure.chars[0] !== "unknown") ?? lead;
    const kind = group.reduce((best, figure) => (KIND[figure.match ?? "cast"] < KIND[best] ? figure.match ?? "cast" : best), lead.match ?? "cast");
    return {
      ...lead,
      ...listed[0],
      // An offer's own fields replace the lead's, including the ones it leaves out.
      priceLabel: listed[0].priceLabel,
      note: listed[0].note ?? (lead.id.startsWith("seed:") ? lead.note : undefined),
      offers: listed.length > 1 ? listed : undefined,
      match: kind,
      chars: named.chars,
      charNames: named.charNames,
      img: lead.img ?? group.find((figure) => figure.img)?.img ?? null,
      jan: group.find((figure) => figure.jan)?.jan,
      nsfw: group.some((figure) => figure.nsfw) || undefined,
    };
  });
}
