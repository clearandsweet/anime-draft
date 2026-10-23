import { NextResponse } from "next/server";
import { matchEbay, type EbayItem } from "../../../lib/shelf/ebay";
import type { CastMember, CatalogShow, ShelfFigure } from "../../../lib/shelf/types";
import { ebayConfigured, searchEbay } from "../ebay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SHOWS = 6;
const strings = (value: unknown, max: number, length = 120) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= length).slice(0, max) : [];

/** The page sends back shows from /api/shelf; only what a search needs is kept. */
function cleanShow(raw: unknown): CatalogShow | null {
  if (!raw || typeof raw !== "object") return null;
  const show = raw as Record<string, unknown>;
  const terms = (show.terms ?? {}) as Record<string, unknown>;
  if (typeof show.id !== "string" || !/^[\w:-]{1,40}$/.test(show.id)) return null;
  const cast = (Array.isArray(show.cast) ? show.cast : []).slice(0, 40).flatMap((member): CastMember[] => {
    const m = member as Record<string, unknown>;
    return typeof m?.key === "string" && typeof m.name === "string"
      ? [{ key: m.key.slice(0, 40), name: m.name.slice(0, 120), names: strings(m.names, 12), fav: Number(m.fav) || 0 }]
      : [];
  });
  return {
    id: show.id,
    score: Number(show.score) || 0,
    terms: { queries: strings(terms.queries, 3, 80), altQueries: strings(terms.altQueries, 3, 80), exact: strings(terms.exact, 40), loose: strings(terms.loose, 40) },
    cast,
  };
}

async function searchShow(show: CatalogShow) {
  const items = new Map<string, EbayItem>();
  for (const query of show.terms.queries.slice(0, 2)) for (const item of await searchEbay(query)) items.set(item.itemId, item);
  return matchEbay([...items.values()], show);
}

/** Live eBay listings for a few shows at a time; the page asks for its best-scored shows first. */
export async function POST(request: Request) {
  if (!ebayConfigured()) return NextResponse.json({ error: "Live eBay search isn't set up on this site yet." }, { status: 503 });
  let shows: CatalogShow[];
  try {
    const body = (await request.json()) as { shows?: unknown };
    shows = (Array.isArray(body.shows) ? body.shows : []).slice(0, MAX_SHOWS).map(cleanShow).filter((s): s is CatalogShow => s !== null);
  } catch {
    return NextResponse.json({ error: "Send the shows to search." }, { status: 400 });
  }
  const figures: ShelfFigure[] = [];
  const searched: { id: string; found: number; error?: string }[] = [];
  await Promise.all(shows.map(async (show) => {
    try {
      const found = await searchShow(show);
      figures.push(...found);
      searched.push({ id: show.id, found: found.length });
    } catch (error) {
      searched.push({ id: show.id, found: 0, error: error instanceof Error ? error.message : "eBay could not be reached." });
    }
  }));
  return NextResponse.json({ figures, searched }, { headers: { "Cache-Control": "no-store" } });
}
