/**
 * Builds app/lib/shelf/solaris.json from Solaris Japan's public Shopify feed of figures: the
 * newest 25,000 (where Shopify's paging stops) plus older ones found through each series'
 * collection. Run with `npm run shelf:solaris`. Raw pages are cached in node_modules/.cache
 * (`--refresh` refetches them).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { SolarisRow } from "../app/lib/shelf/solaris.ts";

type Product = {
  handle: string;
  title: string;
  tags: string[];
  images?: { src?: string }[];
  variants?: { title: string; price: string; available: boolean }[];
};

const OUT = new URL("../app/lib/shelf/solaris.json", import.meta.url);
const CACHE = new URL("../node_modules/.cache/shelf-solaris-raw.json", import.meta.url);
const IMAGE_PREFIX = "https://cdn.shopify.com/s/files/1/0318/2649/";
// Kinds of product the shelf never recommends.
const SKIP_KINDS = new Set(["Plushies", "Model Kit", "Plastic Model", "Accessory", "Amiibo"]);
const refresh = process.argv.includes("--refresh");

const HEADERS = { Accept: "application/json", "User-Agent": "ClearAndSweetFigureShelf/1.0 (https://godisaloli.com)" };
const pause = () => new Promise((resolve) => setTimeout(resolve, 400));

async function pages<T>(path: string, key: string, maxPages: number): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const response = await fetch(`https://solarisjapan.com${path}${path.includes("?") ? "&" : "?"}limit=250&page=${page}`, { headers: HEADERS });
    if (!response.ok) {
      if (page === 1) console.warn(`${path}: ${response.status}`);
      break;
    }
    const batch = ((await response.json()) as Record<string, T[]>)[key] ?? [];
    out.push(...batch);
    await pause();
    if (batch.length < 250) break;
  }
  return out;
}

// The figures collection holds the newest 25,000; each series' own collection ("…-figures") still
// lists its older figures, back to about 2014.
async function crawl(): Promise<Product[]> {
  if (!refresh && existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, "utf8"));
  const byHandle = new Map<string, Product>();
  for (const product of await pages<Product>("/collections/figures/products.json", "products", 100)) byHandle.set(product.handle, product);
  console.log(`figures collection: ${byHandle.size} products`);
  const collections = (await pages<{ handle: string }>("/collections.json", "collections", 30)).map((c) => c.handle).filter((h) => h.includes("figure") && h !== "figures");
  for (const [i, handle] of collections.entries()) {
    const before = byHandle.size;
    for (const product of await pages<Product & { product_type?: string }>(`/collections/${handle}/products.json`, "products", 40)) {
      if (product.product_type === "Figure" && !byHandle.has(product.handle)) byHandle.set(product.handle, product);
    }
    console.log(`${i + 1}/${collections.length} ${handle}: +${byHandle.size - before}`);
  }
  const products = [...byHandle.values()];
  mkdirSync(new URL(".", CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(products));
  return products;
}

const tagged = (tags: string[], prefix: string) => tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
const cents = (price: string) => Math.round(Number(price) * 100) / 100;

/** The cheapest offer of one condition: price, then 0 sold out, 1 in stock, 2 pre-order. */
function cheapest(variants: Product["variants"], used: boolean): [number, 0 | 1 | 2] {
  const own = (variants ?? []).filter((v) => (v.title === "Pre Owned") === used && Number(v.price) > 0);
  const inStock = own.filter((v) => v.available);
  const pool = inStock.length ? inStock : own;
  if (!pool.length) return [0, 0];
  // Solaris sells figures that aren't out yet at an "Early Bird" price.
  const preorder = own.some((v) => v.title === "Early Bird" && v.available);
  return [Math.min(...pool.map((v) => cents(v.price))), !inStock.length ? 0 : preorder ? 2 : 1];
}

const products = await crawl();
const rows: SolarisRow[] = [];
for (const product of products) {
  const kind = tagged(product.tags, "meta-figure-")[0] ?? "";
  const franchise = tagged(product.tags, "meta-franchise-")[0] ?? "";
  if (SKIP_KINDS.has(kind) || franchise === "Original") continue;
  const [newPrice, newStock] = cheapest(product.variants, false);
  const [usedPrice, usedStock] = cheapest(product.variants, true);
  if (!newPrice && !usedPrice) continue;
  const image = (product.images?.[0]?.src ?? "").split("?")[0];
  rows.push([
    product.handle,
    product.title.trim(),
    image.startsWith(IMAGE_PREFIX) ? image.slice(IMAGE_PREFIX.length) : image,
    newPrice,
    newStock,
    usedPrice,
    usedStock,
    kind,
    franchise === "Unknown" ? "" : franchise,
    tagged(product.tags, "meta-character-").join("|"),
    product.tags.includes("nsfw") ? 1 : 0,
  ]);
}
writeFileSync(OUT, JSON.stringify({ checkedOn: new Date().toISOString().slice(0, 10), imagePrefix: IMAGE_PREFIX, rows }));
console.log(`wrote ${rows.length} of ${products.length} products to app/lib/shelf/solaris.json`);
