import { NextResponse } from "next/server";
import { loadMarket } from "../data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Prices, 14-day trends and recent sales for every card in the China-only binder. */
export async function GET() {
  try {
    const market = await loadMarket();
    // A load with gaps is kept briefly so the missing cards are retried soon.
    const gaps = Object.values(market.cards).some((card) => card.errors.length > 0);
    return NextResponse.json(market, {
      headers: { "Cache-Control": gaps ? "public, max-age=60, s-maxage=120" : "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Live prices are unavailable right now." }, { status: 503 });
  }
}
