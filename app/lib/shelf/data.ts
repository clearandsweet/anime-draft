import catalog from "./catalog.json";
import seed from "./seed.json";
import type { ShelfCatalog, ShelfSeed } from "./shelf.ts";

export const SHELF_SEED = seed as ShelfSeed;
export const SHELF_CATALOG = catalog as ShelfCatalog;
