import catalog from "./catalog.json";
import seed from "./seed.json";
import solaris from "./solaris.json";
import type { ShelfCatalog, ShelfSeed } from "./shelf.ts";
import type { SolarisCatalog } from "./solaris.ts";

export const SHELF_SEED = seed as ShelfSeed;
export const SHELF_CATALOG = catalog as ShelfCatalog;
export const SOLARIS_CATALOG = solaris as unknown as SolarisCatalog;
