import { NextResponse } from "next/server";
import { AniListError, anilistErrorResponse } from "../../lib/anilist";
import { cleanRatings } from "../../lib/shelf/characters";
import { SHELF_CATALOG, SHELF_SEED, SOLARIS_CATALOG } from "../../lib/shelf/data";
import { buildShelf } from "../../lib/shelf/shelf";
import { ebayConfigured } from "./ebay";
import { cleanShelfUsername, loadAniListShelf, loadMalShelf } from "./sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Someone's whole list as franchises, with the researched and Solaris figures for them. eBay comes after, from /api/shelf/figures. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const service = body.service === "mal" ? "mal" : "anilist";
    const username = cleanShelfUsername(body.username);
    const list = service === "mal" ? await loadMalShelf(username) : await loadAniListShelf(username);
    if (!list.entries.length) throw new Error(`${username}'s list is empty or private.`);
    const shelf = buildShelf({
      entries: list.entries,
      seed: SHELF_SEED,
      catalog: SHELF_CATALOG,
      solaris: SOLARIS_CATALOG,
      favouriteCharacters: list.favouriteCharacters,
      ratings: cleanRatings(body.ratings),
    });
    return NextResponse.json(
      {
        service,
        username,
        entryCount: list.entries.length,
        unmatched: list.unmatched,
        favouriteCharacters: list.favouriteCharacters,
        catalogDate: SOLARIS_CATALOG.checkedOn,
        liveSearch: ebayConfigured() ? "eBay" : null,
        ...shelf,
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
