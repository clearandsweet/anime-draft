/** Other shops' catalogs (built by scripts/shelf-shops.ts), matched to someone's franchises by listing title. */
import { mfcLink, mfcQuery } from "./links.ts";
import { classifyFigure, findCharacters, hasPhrase, leadingMaker, normalize, seriesHas, stripSuffix, wholeName } from "./match.ts";
import type { CatalogShow, MatchKind, Offer, ShelfFigure } from "./types.ts";

/** handle, title, image, price (shop currency), stock (1 in stock, 2 pre-order), pre-owned, maker, barcode, series named by the shop, note. */
export type ShopRow = [string, string, string, number, 1 | 2, 0 | 1, string, string, string, string];
export type ShopCatalog = {
  id: string;
  name: string;
  host: string;
  currency: "USD" | "JPY";
  jpyPerUsd: number;
  checkedOn: string;
  imagePrefix: string;
  rows: ShopRow[];
};

type Item = { row: ShopRow; text: string; series: string; maker: string };
type Hit = { show: CatalogShow; strength: number; kind: MatchKind; chars: string[] };

const indexes = new WeakMap<ShopCatalog, { items: Item[]; byWord: Map<string, number[]> }>();

function index(catalog: ShopCatalog) {
  const built = indexes.get(catalog);
  if (built) return built;
  // Pre-owned listings name the maker at the front of the title instead of in its own field.
  const items = catalog.rows.map((row) => ({ row, text: normalize(row[1]), series: normalize(row[8]), maker: row[6] || leadingMaker(row[1]) }));
  const byWord = new Map<string, number[]>();
  items.forEach((item, i) => {
    for (const word of new Set(item.text.split(" "))) {
      const list = byWord.get(word);
      if (list) list.push(i);
      else byWord.set(word, [i]);
    }
  });
  const result = { items, byWord };
  indexes.set(catalog, result);
  return result;
}

const longest = (titles: string[]) => titles.reduce((best, title) => (title.length > best.length ? title : best), "");

/**
 * How a listing belongs to a show, read from its title:
 *  - it names one of the show's own titles and someone from the cast (4);
 *  - it names a shorter title, or a related series, and someone from the cast (3);
 *  - it names one of the show's own titles and nobody recognised: a minor character or a set (2);
 *  - it names a sister series ("Magia Record: Puella Magi Madoka Magica Side Story", or anything
 *    under a one-word umbrella like "Macross") and nobody recognised, which counts for less (1).
 * A one-word title in running text ("Aria", "Another") is only trusted next to a character's full name.
 */
function judge(item: Item, show: CatalogShow): Omit<Hit, "show"> | null {
  const { exact, loose, related } = show.terms;
  const named = (title: string) => (item.series !== "" && seriesHas(item.series, title)) || (title.includes(" ") && hasPhrase(item.text, title));
  const own = longest(exact.filter(named));
  const sister = longest(related.filter((title) => title.length > own.length && named(title)));
  const short = own ? "" : longest(loose.filter(named));
  const word = sister || own || short ? "" : longest([...exact, ...loose].filter((title) => !title.includes(" ") && title.length >= 4 && hasPhrase(item.text, title)));
  const title = sister || own || short || word;
  if (!title) return null;
  // Thin evidence: a one-word title in running text, or a short everyday phrase that isn't the
  // shop's own label ("School Days" also names a costume on another show's figure). It then
  // takes a character's name in full, and without one the listing isn't trusted at all.
  const labelled = item.series !== "" && (item.series === title || stripSuffix(item.series) === title);
  const thin = Boolean(word) || (!labelled && title.split(" ").length < 3 && title.length < 14);

  // The show's name isn't a character: the longest title the listing carries is taken out before
  // looking for the cast, and so is any other title that isn't also someone's name ("Sailor Moon"
  // stays, since the second mention is usually her). The maker goes too: Max Factory isn't Max.
  let rest = ` ${item.text} `;
  const present = [...exact, ...loose, ...related].filter((title) => rest.includes(` ${title} `)).sort((a, b) => b.length - a.length);
  const isName = (candidate: string) => show.cast.some((member) => member.names.some((name) => hasPhrase(candidate, wholeName(name))));
  present.forEach((candidate, i) => {
    if (i === 0 || !isName(candidate)) rest = rest.replace(` ${candidate} `, " ");
  });
  const maker = normalize(item.maker);
  if (maker) rest = rest.replace(` ${maker} `, " ");
  const chars = findCharacters(rest.trim(), show.cast, thin);

  if (chars.length) return { strength: own && !sister ? 4 : 3, kind: "cast", chars };
  if (!own || thin) return null;
  // A sister series: a longer related title, a one-word umbrella, or a numbered sequel ("… 4").
  const sequel = new RegExp(` ${own} (?:\\d{1,2}|ii|iii|iv|v|vi|zero)(?: |$)`).test(` ${item.text} `);
  if (sister || sequel || !own.includes(" ")) return { strength: 1, kind: "related", chars };
  return { strength: 2, kind: "series", chars };
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString("en-US")}`;

/** A listing title without the sales tags shops put in front ("[Resale]", "TV Anime"). */
function displayName(title: string) {
  const cleaned = title
    .replace(/^(?:\s*(?:\[[^\]]*\]|【[^】]*】))+/, "")
    .replace(/^\s*(?:TV )?Anime\s+(?=")/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 8 ? cleaned : title;
}

export function matchShop(catalog: ShopCatalog, shows: CatalogShow[]): ShelfFigure[] {
  const { items, byWord } = index(catalog);
  const best = new Map<number, Hit>();
  for (const show of shows) {
    const candidates = new Set<number>();
    for (const title of [...show.terms.exact, ...show.terms.loose, ...show.terms.related]) {
      const lists = title.split(" ").map((word) => byWord.get(word) ?? []);
      for (const i of lists.reduce((a, b) => (b.length < a.length ? b : a))) candidates.add(i);
    }
    for (const i of candidates) {
      const verdict = judge(items[i], show);
      if (!verdict) continue;
      const previous = best.get(i);
      if (!previous || verdict.strength > previous.strength || (verdict.strength === previous.strength && show.score > previous.show.score)) {
        best.set(i, { show, ...verdict });
      }
    }
  }
  const figures: ShelfFigure[] = [];
  for (const [i, hit] of best) {
    const [handle, title, image, price, stock, used, , jan, , note] = items[i].row;
    const maker = items[i].maker;
    const kind = classifyFigure(title, "", maker);
    if (!kind) continue;
    const castNames = new Map(hit.show.cast.map((member) => [member.key, member.name]));
    const usd = catalog.currency === "JPY" ? Math.round((100 * price) / catalog.jpyPerUsd) / 100 : price;
    // MFC's search finds a figure by its barcode.
    const link = mfcLink({ name: title, mfcQuery: jan || mfcQuery(title) });
    const offer: Offer = {
      source: catalog.name,
      url: `https://${catalog.host}/products/${handle}`,
      price: usd,
      priceLabel: catalog.currency === "JPY" ? yen(price) : undefined,
      cond: used ? "pre-owned" : "new",
      avail: stock === 2 ? "pre-order" : "in stock",
      note: note || undefined,
    };
    figures.push({
      ...offer,
      offers: [offer],
      id: `${catalog.id}:${handle}`,
      show: hit.show.id,
      match: hit.kind,
      name: displayName(title),
      line: kind.line,
      maker,
      tier: kind.tier,
      qAdj: kind.adj || undefined,
      chars: hit.chars.length ? hit.chars : ["unknown"],
      charNames: hit.chars.map((key) => castNames.get(key) ?? key),
      img: image ? `${image.startsWith("http") ? image : catalog.imagePrefix + image}?width=400` : null,
      mfcHref: link.href,
      mfcDirect: link.direct,
      jan: jan || undefined,
    });
  }
  return figures;
}
