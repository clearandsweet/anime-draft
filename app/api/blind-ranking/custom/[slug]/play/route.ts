import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { selectCustomRankingPlay, toPublicCustomRanking } from "../../../../../lib/customRanking";
import { incrementCustomRankingPlays, loadCustomRanking } from "../../../customRankings.store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const slug = (await params).slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 70);
  const ranking = await loadCustomRanking(slug);
  if (!ranking) return NextResponse.json({ error: "Ranking not found." }, { status: 404 });
  const items = selectCustomRankingPlay(toPublicCustomRanking(ranking), randomUUID());
  await incrementCustomRankingPlays(slug);
  return NextResponse.json({ items });
}
