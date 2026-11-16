import catalog from "./catalog.json";
import seed from "./seed.json";
import type { ShelfCatalog, ShelfSeed } from "./shelf.ts";
import animota from "./shops/animota.json";
import ninoma from "./shops/ninoma.json";
import type { ShopCatalog } from "./shops.ts";
import solaris from "./solaris.json";
import type { SolarisCatalog } from "./solaris.ts";

export const SHELF_SEED = seed as ShelfSeed;
export const SHELF_CATALOG = catalog as ShelfCatalog;
export const SOLARIS_CATALOG = solaris as unknown as SolarisCatalog;
/** Other shops' figures for sale, read by listing title. */
export const SHOP_CATALOGS = [animota, ninoma] as unknown as ShopCatalog[];
