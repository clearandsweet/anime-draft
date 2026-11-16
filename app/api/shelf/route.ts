import { NextResponse } from "next/server";
import { AniListError, anilistErrorResponse } from "../../lib/anilist";
import { cleanRatings } from "../../lib/shelf/characters";
import { SHELF_CATALOG, SHELF_SEED, SHOP_CATALOGS, SOLARIS_CATALOG } from "../../lib/shelf/data";
import { buildShelf } from "../../lib/shelf/shelf";
import { ebayReady } from "./ebay";
import { cleanShelfUsername, loadAniListShelf, loadMalShelf } from "./sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CATALOGS = [
  { name: "Solaris Japan", checkedOn: SOLARIS_CATALOG.checkedOn, listings: SOLARIS_CATALOG.rows.length },
  ...SHOP_CATALOGS.map((shop) => ({ name: shop.name, checkedOn: shop.checkedOn, listings: shop.rows.length })),
];

/** Someone's whole list as franchises, with every catalog's figures for them. eBay comes after, from /api/shelf/figures. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const service = body.service === "mal" ? "mal" : "anilist";
    const username = cleanShelfUsername(body.username);
    const [list, live] = await Promise.all([
      service === "mal" ? loadMalShelf(username) : loadAniListShelf(username),
      ebayReady(),
    ]);
    if (!list.entries.length) throw new Error(`${username}'s list is empty or private.`);
    const shelf = buildShelf({
      entries: list.entries,
      seed: SHELF_SEED,
      catalog: SHELF_CATALOG,
      solaris: SOLARIS_CATALOG,
      shops: SHOP_CATALOGS,
      favouriteCharacters: list.favouriteCharacters,
      favouriteAnime: list.favouriteAnime,
      ratings: cleanRatings(body.ratings),
    });
    return NextResponse.json(
      {
        service,
        username,
        entryCount: list.entries.length,
        unmatched: list.unmatched,
        favouriteCharacters: list.favouriteCharacters,
        catalogs: CATALOGS,
        liveSearch: live ? "eBay" : null,
        ...shelf,
        // Related titles are only needed to match catalogs here.
        shows: shelf.shows.map((show) => ({ ...show, terms: { ...show.terms, related: [] } })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AniListError) return anilistErrorResponse(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The shelf could not be built." },
      { status: 400 }
    );
  }
}
