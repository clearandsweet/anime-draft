import { AniListError, anilistErrorResponse } from "../../../lib/anilist";
import { NextResponse } from "next/server";
import { loadBlindRankingCandidates } from "../sources";
import { blindRankingError, parseBlindRankingConfig, parseBlindRankingSource } from "../request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const config = parseBlindRankingConfig(body);
    const source = parseBlindRankingSource(body.source, config.mode);
    const seed =
      typeof body.seed === "string" && body.seed.trim()
        ? body.seed.slice(0, 100)
        : crypto.randomUUID();
    const result = await loadBlindRankingCandidates({
      ...config,
      sources: source ? [{ contributor: source.username, source }] : [],
      seed,
    });
    if (result.items.length < config.count) {
      return NextResponse.json(
        {
          error: `Only ${result.items.length} eligible ${
            config.mode === "anime" ? "shows" : "characters"
          } were found. Remove a filter or choose a smaller board.`,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AniListError) return anilistErrorResponse(error);
    return NextResponse.json(
      { error: blindRankingError(error) },
      { status: 400 }
    );
  }
}
