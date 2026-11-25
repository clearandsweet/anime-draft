import { NextResponse } from "next/server";
import { loadMarket } from "../data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Run daily by Vercel Cron (vercel.json) so every card gets a reading each day, which the 14-day
 * trend is built from. Prices are cached for 20 hours, so calling it again soon after is cheap.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const market = await loadMarket();
  const cards = Object.values(market.cards);
  return NextResponse.json(
    {
      updatedAt: market.updatedAt,
      sources: market.sources,
      priced: cards.filter((c) => c.pc?.ungraded || c.pc?.psa10).length,
      withListings: cards.filter((c) => c.ask).length,
      errors: cards.flatMap((c) => c.errors.map((e) => `${c.id}: ${e}`)).slice(0, 20),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
