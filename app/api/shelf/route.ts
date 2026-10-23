import { NextResponse } from "next/server";
import { AniListError, anilistErrorResponse } from "../../lib/anilist";
import { cleanRatings } from "../../lib/shelf/characters";
import { SHELF_CATALOG, SHELF_SEED } from "../../lib/shelf/data";
import { buildShelf } from "../../lib/shelf/shelf";
import { cleanShelfUsername, loadAniListShelf, loadMalShelf } from "./sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const service = body.service === "mal" ? "mal" : "anilist";
    const username = cleanShelfUsername(body.username);
    const list = service === "mal" ? await loadMalShelf(username) : await loadAniListShelf(username);
    const shelf = buildShelf({ seed: SHELF_SEED, catalog: SHELF_CATALOG, ...list, ratings: cleanRatings(body.ratings) });
    return NextResponse.json(
      { service, username, entryCount: list.entries.length, ...shelf },
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
