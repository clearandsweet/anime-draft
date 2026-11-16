/** Solaris Japan's figure catalog (built by scripts/shelf-solaris.ts), matched to someone's franchises. */
import { mfcLink, mfcQuery } from "./links.ts";
import { classifyFigure, findCharacters, findTaggedCharacters, normalize, seriesHas } from "./match.ts";
import type { CatalogShow, Condition, MatchKind, Offer, ShelfFigure } from "./types.ts";

/** handle, title, image, new price, new stock, pre-owned price, pre-owned stock, kind, franchise, characters ("|"), 18+. Stock: 0 sold out, 1 in stock, 2 pre-order. */
export type SolarisRow = [string, string, string, number, 0 | 1 | 2, number, 0 | 1 | 2, string, string, string, 0 | 1];
export type SolarisCatalog = { checkedOn: string; imagePrefix: string; rows: SolarisRow[] };

// Titles read "Series - Character - Line (Maker)"; the shop also tags a franchise and characters.
type Item = { row: SolarisRow; series: string; franchise: string; rest: string; tags: string[] };
type Hit = { show: CatalogShow; strength: number; kind: MatchKind; chars: string[] };

// "(Max Factory)" or "(Alter) [Shop Exclusive]" closing a title.
const MAKER_SUFFIX = /\s*\(([^()]+)\)(?:\s*\[[^\]]*\])?\s*$/;

const indexes = new WeakMap<SolarisCatalog, { items: Item[]; byWord: Map<string, number[]> }>();

function index(catalog: SolarisCatalog) {
  const built = indexes.get(catalog);
  if (built) return built;
  const items = catalog.rows.map((row) => {
    const [, title, , , , , , , franchise, chars] = row;
    const parts = title.replace(MAKER_SUFFIX, "").split(" - ");
    return {
      row,
      series: normalize(parts.length > 1 ? parts[0] : title),
      franchise: normalize(franchise),
      rest: normalize(parts.length > 1 ? parts.slice(1).join(" ") : ""),
      tags: chars ? chars.split("|") : [],
    };
  });
  const byWord = new Map<string, number[]>();
  items.forEach((item, i) => {
    for (const word of new Set(`${item.series} ${item.franchise}`.split(" "))) {
      const list = byWord.get(word);
      if (list) list.push(i);
      else byWord.set(word, [i]);
    }
  });
  const result = { items, byWord };
  indexes.set(catalog, result);
  return result;
}

/**
 * How a listing belongs to a show:
 *  - it shows someone from the cast, under the show's title (4) or a shorter or related title (3);
 *  - it's listed under exactly the show's title but shows nobody recognised: a minor character or a set (2);
 *  - the shop files it in the same franchise but under another series, with nobody recognised: a
 *    sister series (Macross Frontier for Macross), which counts for less (1).
 */
function judge(item: Item, show: CatalogShow): Omit<Hit, "show"> | null {
  const named = [item.series, item.franchise].filter(Boolean);
  const { exact, loose, related } = show.terms;
  const own = named.some((series) => exact.some((title) => seriesHas(series, title)));
  if (!own && !named.some((series) => [...loose, ...related].some((title) => seriesHas(series, title)))) return null;
  // The shop's character tags decide; an untagged listing is read by its title instead.
  const chars = item.tags.length ? findTaggedCharacters(item.tags, show.cast) : findCharacters(item.rest, show.cast);
  if (chars.length) return { strength: own ? 4 : 3, kind: "cast", chars };
  if (exact.includes(item.series)) return { strength: 2, kind: "series", chars };
  return own ? { strength: 1, kind: "related", chars } : null;
}

export function matchSolaris(catalog: SolarisCatalog, shows: CatalogShow[], skipHandles = new Set<string>()): ShelfFigure[] {
  const { items, byWord } = index(catalog);
  const best = new Map<number, Hit>();
  for (const show of shows) {
    const candidates = new Set<number>();
    for (const title of [...show.terms.exact, ...show.terms.loose, ...show.terms.related]) {
      const lists = title.split(" ").map((word) => byWord.get(word) ?? []);
      for (const i of lists.reduce((a, b) => (b.length < a.length ? b : a))) candidates.add(i);
    }
    for (const i of candidates) {
      const item = items[i];
      if (skipHandles.has(item.row[0])) continue;
      const verdict = judge(item, show);
      if (!verdict) continue;
      const previous = best.get(i);
      if (!previous || verdict.strength > previous.strength || (verdict.strength === previous.strength && show.score > previous.show.score)) {
        best.set(i, { show, ...verdict });
      }
    }
  }
  const figures: ShelfFigure[] = [];
  for (const [i, hit] of best) {
    const figure = toFigure(items[i], hit, catalog);
    if (figure) figures.push(figure);
  }
  return figures;
}

const STOCK = { 0: "sold out", 1: "in stock", 2: "pre-order" } as const;
const SOURCE = "Solaris Japan";

export function solarisImage(catalog: SolarisCatalog, path: string) {
  if (!path) return null;
  return `${path.startsWith("http") ? path : catalog.imagePrefix + path}?width=400`;
}

/** The shop's new and pre-owned prices for one listing, the one to buy first. */
export function solarisOffers(row: SolarisRow): Offer[] {
  const [handle, , , newPrice, newStock, usedPrice, usedStock] = row;
  const url = `https://solarisjapan.com/products/${handle}`;
  const offers: Offer[] = [];
  if (newPrice) offers.push({ source: SOURCE, url, price: newPrice, cond: "new" as Condition, avail: STOCK[newStock] });
  if (usedPrice) offers.push({ source: SOURCE, url, price: usedPrice, cond: "pre-owned" as Condition, avail: STOCK[usedStock] });
  return offers;
}

function toFigure(item: Item, hit: Hit, catalog: SolarisCatalog): ShelfFigure | null {
  const [handle, title, image, , , , , kind, , , nsfw] = item.row;
  const maker = title.match(MAKER_SUFFIX)?.[1] ?? "";
  const kindInfo = classifyFigure(title, kind, maker);
  const offers = solarisOffers(item.row);
  if (!kindInfo || !offers.length) return null;
  const parts = title.replace(MAKER_SUFFIX, "").split(" - ");
  const name = (parts.length > 1 ? parts.slice(1).join(" - ") : parts[0]).trim() || title;
  const castNames = new Map(hit.show.cast.map((member) => [member.key, member.name]));
  const link = mfcLink({ name, mfcQuery: mfcQuery(title) });
  return {
    ...offers[0],
    offers,
    id: `solaris:${handle}`,
    show: hit.show.id,
    match: hit.kind,
    name,
    line: kindInfo.line,
    maker,
    tier: kindInfo.tier,
    qAdj: kindInfo.adj || undefined,
    chars: hit.chars.length ? hit.chars : ["unknown"],
    charNames: hit.chars.length ? hit.chars.map((key) => castNames.get(key) ?? key) : item.tags,
    img: solarisImage(catalog, image),
    mfcHref: link.href,
    mfcDirect: link.direct,
    nsfw: nsfw === 1,
  };
}
