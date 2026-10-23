/** Solaris Japan's figure catalog (built by scripts/shelf-solaris.ts), matched to someone's franchises. */
import { mfcLink, mfcQuery } from "./links.ts";
import { classifyFigure, findTaggedCharacters, normalize, seriesHas, titleMatch } from "./match.ts";
import type { CatalogShow, Condition, ShelfFigure } from "./types.ts";

/** handle, title, image, new price, new stock, pre-owned price, pre-owned stock, kind, franchise, characters ("|"), 18+. Stock: 0 sold out, 1 in stock, 2 pre-order. */
export type SolarisRow = [string, string, string, number, 0 | 1 | 2, number, 0 | 1 | 2, string, string, string, 0 | 1];
export type SolarisCatalog = { checkedOn: string; imagePrefix: string; rows: SolarisRow[] };

type Item = { row: SolarisRow; series: string[]; tags: string[] };
type Hit = { show: CatalogShow; strength: number; chars: string[] };

const indexes = new WeakMap<SolarisCatalog, { items: Item[]; byWord: Map<string, number[]> }>();

// Titles read "Series - Character - Line (Maker)"; the series and the shop's franchise tag both name the show.
function index(catalog: SolarisCatalog) {
  const built = indexes.get(catalog);
  if (built) return built;
  const items = catalog.rows.map((row) => {
    const [, title, , , , , , , franchise, chars] = row;
    const parts = title.split(" - ");
    const series = [normalize(parts.length > 1 ? parts[0] : title), normalize(franchise)].filter(Boolean);
    return { row, series: [...new Set(series)], tags: chars ? chars.split("|") : [] };
  });
  const byWord = new Map<string, number[]>();
  items.forEach((item, i) => {
    for (const word of new Set(item.series.join(" ").split(" "))) {
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
 * How sure a listing belongs to a show: 4 whole title and a cast member, 3 shorter title and a cast
 * member, 2 whole title with no character tagged, 1 the exact series but a character outside the
 * cast the shelf knows. 0 means it doesn't belong.
 */
function strength(item: Item, show: CatalogShow, chars: string[]) {
  const match = item.series
    .map((series) => titleMatch(series, show.terms, seriesHas))
    .reduce((best, next) => (next && (!best || next.strength > best.strength) ? next : best), null as ReturnType<typeof titleMatch>);
  if (!match) return 0;
  if (!item.tags.length) return match.strength === 2 ? 2 : 0;
  if (chars.length) return match.strength + 2;
  return item.series.some((series) => show.terms.exact.includes(series)) ? 1 : 0;
}

export function matchSolaris(catalog: SolarisCatalog, shows: CatalogShow[], skipHandles = new Set<string>()): ShelfFigure[] {
  const { items, byWord } = index(catalog);
  const best = new Map<number, Hit>();
  for (const show of shows) {
    const candidates = new Set<number>();
    for (const title of [...show.terms.exact, ...show.terms.loose]) {
      const lists = title.split(" ").map((word) => byWord.get(word) ?? []);
      for (const i of lists.reduce((a, b) => (b.length < a.length ? b : a))) candidates.add(i);
    }
    for (const i of candidates) {
      const item = items[i];
      if (skipHandles.has(item.row[0])) continue;
      const chars = findTaggedCharacters(item.tags, show.cast);
      const sure = strength(item, show, chars);
      if (!sure) continue;
      const previous = best.get(i);
      if (!previous || sure > previous.strength || (sure === previous.strength && show.score > previous.show.score)) {
        best.set(i, { show, strength: sure, chars });
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
const usd = (n: number) => `$${n.toFixed(2)}`;

export function solarisImage(catalog: SolarisCatalog, path: string) {
  if (!path) return null;
  return `${path.startsWith("http") ? path : catalog.imagePrefix + path}?width=400`;
}

function toFigure(item: Item, hit: Hit, catalog: SolarisCatalog): ShelfFigure | null {
  const [handle, title, image, newPrice, newStock, usedPrice, usedStock, kind, , , nsfw] = item.row;
  const maker = title.match(/\(([^()]+)\)(?:\s*\[[^\]]*\])?\s*$/)?.[1] ?? "";
  const kindInfo = classifyFigure(title, kind, maker);
  if (!kindInfo) return null;
  const offers = [
    newPrice ? { price: newPrice, cond: "new" as Condition, stock: newStock } : null,
    usedPrice ? { price: usedPrice, cond: "pre-owned" as Condition, stock: usedStock } : null,
  ].filter((offer) => offer !== null);
  const buyable = offers.filter((offer) => offer.stock);
  const pick = (buyable.length ? buyable : offers).sort((a, b) => a.price - b.price)[0];
  const parts = title.split(" - ");
  const name = (parts.length > 1 ? parts.slice(1).join(" - ") : title).replace(/\s*\([^()]*\)(?:\s*\[[^\]]*\])?\s*$/, "").trim() || title;
  const castNames = new Map(hit.show.cast.map((member) => [member.key, member.name]));
  const link = mfcLink({ name, mfcQuery: mfcQuery(title) });
  return {
    id: `solaris:${handle}`,
    show: hit.show.id,
    name,
    line: kindInfo.line,
    maker,
    tier: kindInfo.tier,
    chars: hit.chars.length ? hit.chars : ["unknown"],
    charNames: hit.chars.length ? hit.chars.map((key) => castNames.get(key) ?? key) : item.tags,
    price: pick.price,
    cond: pick.cond,
    avail: STOCK[pick.stock],
    source: "Solaris Japan",
    url: `https://solarisjapan.com/products/${handle}`,
    img: solarisImage(catalog, image),
    mfcHref: link.href,
    mfcDirect: link.direct,
    nsfw: nsfw === 1,
    note: buyable.length === 2 ? `New ${usd(newPrice)} · pre-owned ${usd(usedPrice)}` : undefined,
  };
}
