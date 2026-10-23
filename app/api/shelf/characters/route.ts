import { NextResponse } from "next/server";
import { AniListError, anilistErrorResponse } from "../../../lib/anilist";
import { SHELF_CATALOG, SHELF_SEED } from "../../../lib/shelf/data";
import { ratingKey } from "../../../lib/shelf/characters";
import { gameCharacters, searchGames, searchShows, showCharacters } from "../characterSources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many shelf figures depict each AniList character, keyed like the ratings. */
const FIGURES_BY_CHARACTER = (() => {
  const counts: Record<string, number> = {};
  for (const figure of Object.values(SHELF_SEED.figures)) {
    for (const charId of figure.chars) {
      const anilistId = SHELF_CATALOG.chars[charId]?.anilistId;
      if (anilistId) counts[ratingKey("anilist", anilistId)] = (counts[ratingKey("anilist", anilistId)] ?? 0) + 1;
    }
  }
  return counts;
})();

/**
 * GET ?q=...&kind=show|game  searches for a show (AniList) or game (Wikidata).
 * GET ?source=anilist|wikidata&id=...  returns that work's five most popular characters.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const query = params.get("q")?.trim();
    if (query !== undefined) {
      if (query.length < 2 || query.length > 80) return NextResponse.json({ error: "Type at least two letters to search." }, { status: 400 });
      const works = params.get("kind") === "game" ? await searchGames(query) : await searchShows(query);
      return NextResponse.json({ works });
    }
    const source = params.get("source");
    const id = params.get("id") ?? "";
    let characters;
    if (source === "anilist" && /^\d{1,9}$/.test(id)) characters = await showCharacters(Number(id));
    else if (source === "wikidata" && /^Q\d{1,12}$/.test(id)) characters = await gameCharacters(id);
    else return NextResponse.json({ error: "Pick a show or game first." }, { status: 400 });
    return NextResponse.json({
      characters: characters.map((c) => ({ ...c, figures: FIGURES_BY_CHARACTER[c.key] ?? 0 })),
    });
  } catch (error) {
    if (error instanceof AniListError) return anilistErrorResponse(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Characters could not be loaded." },
      { status: 502 }
    );
  }
}
