/**
 * Builds app/lib/shelf/shops/<shop>.json from other shops' public Shopify feeds: the figures each
 * has for sale today (in stock or on pre-order), with price, condition, photo and barcode.
 *   animota  new figures plus a large pre-owned range (the Jungle shops), in US dollars
 *   ninoma   new and in-stock older figures, in yen
 * Run with `npm run shelf:shops` (or name one shop). Pages are cached in node_modules/.cache;
 * `--refresh` fetches them again. A feed stops at 25,000 products, so each shop is read through
 * several of its collections.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { classifyFigure } from "../app/lib/shelf/match.ts";
import type { ShopCatalog, ShopRow } from "../app/lib/shelf/shops.ts";

type Product = {
  handle: string;
  title: string;
  vendor: string;
  product_type: string;
  tags: string[];
  images?: { src?: string }[];
  variants?: { title: string; price: string; available: boolean; sku?: string | null }[];
};
type Slim = { h: string; t: string; v: string; y: string; g: string[]; i: string; o: [string, number, boolean, string][] };

type Shop = {
  id: string;
  name: string;
  host: string;
  currency: "USD" | "JPY";
  /** Milliseconds between requests; the shop throttles anything faster. */
  pace: number;
  /** Collections read in full (up to the 25,000 cap). */
  feeds: string[];
  /** Further collections worth reading for depth, picked from the shop's collection list. */
  extra?: (collection: { handle: string; products_count?: number }) => boolean;
  keep: (product: Slim) => boolean;
  describe: (product: Slim) => { stock: 1 | 2; used: boolean; note: string; maker: string; series: string };
};

const quoted = (title: string) => title.match(/"([^"]{2,80})"/)?.[1] ?? "";
const ANIMOTA_FLAGS = /^(stock|prize|pre-order|pre-order-new|used_Rank_\w+|new|sale)$/i;

const SHOPS: Shop[] = [
  {
    id: "animota",
    name: "animota",
    host: "animota.net",
    currency: "USD",
    pace: 1200,
    feeds: ["figure-model-kit", "all-products-excluding-partner-used-products", "rank-ss", "rank-s", "rank-a", "rank-b", "used-goods", "prize-figure-collections", "nendoroid", "figma"],
    // Series pages reach pre-owned figures the big feeds cut off; per-character pages only repeat them.
    extra: (c) => (c.products_count ?? 0) >= 5 && (c.products_count ?? 0) <= 4000 && !/figures-merchandise|bestsellers|plush|card|ocg|tcg|gundam|model-kit|blanket|towel/.test(c.handle),
    keep: (p) => /figure/i.test(p.y),
    describe: (p) => {
      const rank = p.g.find((tag) => /^used_Rank_/i.test(tag))?.replace(/^used_Rank_/i, "");
      const variant = p.o.find((o) => o[2])?.[0] ?? "";
      const used = Boolean(rank) || /second-hand|unused/i.test(variant);
      const seriesTag = p.g.find((tag) => /^".+" Series$/.test(tag))?.replace(/^"(.+)" Series$/, "$1");
      const leading = p.g.find((tag) => !ANIMOTA_FLAGS.test(tag) && tag.length >= 3 && p.t.toLowerCase().startsWith(tag.toLowerCase()));
      return {
        stock: p.g.some((tag) => /^pre-order/i.test(tag)) ? 2 : 1,
        used,
        note: rank ? `Pre-owned, rank ${rank}` : /unused/i.test(variant) ? "Unused, unopened" : "",
        maker: /jungle|animota/i.test(p.v) ? "" : p.v,
        series: quoted(p.t) || seriesTag || leading || "",
      };
    },
  },
  {
    id: "ninoma",
    name: "Ninoma",
    host: "ninoma.com",
    currency: "JPY",
    pace: 400,
    feeds: ["figures", "figures-for-sale", "prize-figures", "scale-figures", "pre-order", "figures-companies-good-smile-company-nendoroid"],
    // BtoB listings are wholesale prices for trade accounts.
    keep: (p) => p.y === "Figure" && !p.g.includes("BtoB"),
    describe: (p) => ({ stock: p.g.includes("Pre-Order") ? 2 : 1, used: false, note: "", maker: p.v, series: quoted(p.t) }),
  },
];

const HEADERS = { Accept: "application/json", "User-Agent": "ClearAndSweetFigureShelf/1.0 (https://godisaloli.com)" };
const IMAGE_PREFIX = "https://cdn.shopify.com/s/files/";
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const wanted = args.filter((arg) => !arg.startsWith("--"));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits out throttling (a shop answers 429 when asked too fast) instead of giving up on a page. */
async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(40_000) });
      if (response.status === 429 || response.status === 430 || response.status >= 500) {
        const asked = Number(response.headers.get("retry-after"));
        const wait = Math.max(Number.isFinite(asked) ? asked * 1000 : 0, Math.min(180_000, 20_000 * (attempt + 1)));
        console.warn(`${response.status} from ${new URL(url).host}; waiting ${Math.round(wait / 1000)}s`);
        await pause(wait);
        continue;
      }
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      await pause(5000 * (attempt + 1));
    }
  }
  throw new Error(`Gave up on ${url}`);
}

const slim = (p: Product): Slim => ({
  h: p.handle,
  t: p.title.replace(/\s+/g, " ").trim(),
  v: p.vendor ?? "",
  y: p.product_type ?? "",
  g: p.tags ?? [],
  i: (p.images?.[0]?.src ?? "").split("?")[0],
  o: (p.variants ?? []).map((v) => [v.title, Number(v.price), v.available, v.sku ?? ""]),
});

type Progress = { done: string[]; products: Slim[] };

// An interrupted run picks up from its last finished collection.
async function crawl(shop: Shop): Promise<Slim[]> {
  const cache = new URL(`../node_modules/.cache/shelf-shop-${shop.id}.json`, import.meta.url);
  const partial = new URL(`../node_modules/.cache/shelf-shop-${shop.id}.partial.json`, import.meta.url);
  if (!refresh && existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  mkdirSync(new URL(".", cache), { recursive: true });
  const saved: Progress = existsSync(partial) ? JSON.parse(readFileSync(partial, "utf8")) : { done: [], products: [] };
  const done = new Set(saved.done);
  const byHandle = new Map(saved.products.map((product) => [product.h, product]));
  if (done.size) console.log(`${shop.id}: resuming after ${done.size} collections (${byHandle.size} products)`);
  let lastSave = Date.now();
  const save = (force = false) => {
    if (!force && Date.now() - lastSave < 120_000) return;
    writeFileSync(partial, JSON.stringify({ done: [...done], products: [...byHandle.values()] } satisfies Progress));
    lastSave = Date.now();
  };
  const read = async (collection: string) => {
    if (done.has(collection)) return 0;
    const before = byHandle.size;
    for (let page = 1; page <= 100; page++) {
      const data = await getJson<{ products?: Product[] }>(`https://${shop.host}/collections/${collection}/products.json?limit=250&page=${page}`);
      const batch = data?.products ?? [];
      for (const product of batch) if (!byHandle.has(product.handle)) byHandle.set(product.handle, slim(product));
      await pause(shop.pace);
      if (batch.length < 250) break;
    }
    done.add(collection);
    save();
    return byHandle.size - before;
  };
  for (const feed of shop.feeds) {
    const added = await read(feed);
    console.log(`${shop.id} ${feed}: +${added} (${byHandle.size})`);
    save(true);
  }
  if (shop.extra) {
    const collections: { handle: string; products_count?: number }[] = [];
    for (let page = 1; page <= 20; page++) {
      const data = await getJson<{ collections?: { handle: string; products_count?: number }[] }>(`https://${shop.host}/collections.json?limit=250&page=${page}`);
      if (!data?.collections?.length) break;
      collections.push(...data.collections);
      await pause(shop.pace);
    }
    const more = collections.filter((c) => !shop.feeds.includes(c.handle) && shop.extra!(c));
    for (const [i, collection] of more.entries()) {
      const added = await read(collection.handle);
      if (added || i % 25 === 0) console.log(`${shop.id} ${i + 1}/${more.length} ${collection.handle}: +${added} (${byHandle.size})`);
    }
  }
  const products = [...byHandle.values()];
  writeFileSync(cache, JSON.stringify(products));
  if (existsSync(partial)) unlinkSync(partial);
  return products;
}

// A JAN/EAN barcode identifies the same figure in every shop. Codes starting 2 are a shop's own.
const barcode = (sku: string) => (/^\d{13}$/.test(sku) && !sku.startsWith("2") ? sku : "");

async function yenPerDollar() {
  const data = await getJson<{ rates?: { JPY?: number } }>("https://open.er-api.com/v6/latest/USD");
  return Math.round((data?.rates?.JPY ?? 150) * 100) / 100;
}

const rate = await yenPerDollar();
for (const shop of SHOPS.filter((s) => !wanted.length || wanted.includes(s.id))) {
  const products = await crawl(shop);
  const rows: ShopRow[] = [];
  for (const product of products) {
    if (!shop.keep(product)) continue;
    const offers = product.o.filter((o) => o[2] && o[1] > 0);
    if (!offers.length) continue;
    const info = shop.describe(product);
    if (!classifyFigure(product.t, "", info.maker)) continue;
    const best = offers.reduce((a, b) => (b[1] < a[1] ? b : a));
    rows.push([
      product.h,
      product.t,
      product.i.startsWith(IMAGE_PREFIX) ? product.i.slice(IMAGE_PREFIX.length) : product.i,
      best[1],
      info.stock,
      info.used ? 1 : 0,
      info.maker,
      barcode(best[3]),
      info.series,
      info.note,
    ]);
  }
  const catalog: ShopCatalog = { id: shop.id, name: shop.name, host: shop.host, currency: shop.currency, jpyPerUsd: rate, checkedOn: new Date().toISOString().slice(0, 10), imagePrefix: IMAGE_PREFIX, rows };
  const out = new URL(`../app/lib/shelf/shops/${shop.id}.json`, import.meta.url);
  mkdirSync(new URL(".", out), { recursive: true });
  writeFileSync(out, JSON.stringify(catalog));
  console.log(`wrote ${rows.length} of ${products.length} ${shop.name} products (${rows.filter((r) => r[5]).length} pre-owned, ${rows.filter((r) => r[7]).length} with barcodes)`);
}
