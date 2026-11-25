import { kv } from "@vercel/kv";
import { CARDS, excludedWords, type CnCard } from "../../lib/chinaBinder/cards";
import {
  addHistory,
  bestTrend,
  isoDay,
  parsePriceCharting,
  rawAsking,
  recentSales,
  summarizeAsking,
  trackedTrend,
  type AskingSummary,
  type HistoryPoint,
  type ListingLike,
  type PriceChartingData,
  type Sale,
  type Trend,
} from "../../lib/chinaBinder/market";
import { cached, hasKvEnvironment } from "../shelf/cache";
import { accessToken, ebayReady } from "../shelf/ebay";

const PC_BASE = "https://www.pricecharting.com/game/";
const EBAY_SEARCH = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const UA = "Mozilla/5.0 (compatible; ClearandsweetBinder/1.0; +https://godisaloli.com/pokemon-cn-binder)";
/** Prices are refreshed about once a day: the cron job runs daily and these expire just before it. */
const TTL = 20 * 3600;
const HISTORY_DAYS = 60;

export type CardMarket = {
  id: string;
  pc: { ungraded: number | null; grade9: number | null; psa10: number | null; url: string } | null;
  trend: Trend;
  askTrend: Trend;
  sold: { raw: Sale[]; psa10: Sale[] };
  ask: (AskingSummary & { search: string }) | null;
  history: HistoryPoint[];
  errors: string[];
};

export type MarketResponse = {
  updatedAt: string;
  today: string;
  sources: { pricecharting: boolean; ebay: boolean; history: boolean };
  cards: Record<string, CardMarket>;
};

function priceCharting(card: CnCard): Promise<PriceChartingData> {
  return cached(`cnbinder:pc:v1:${card.id}`, TTL, async () => {
    const response = await fetch(PC_BASE + card.pc, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`PriceCharting answered ${response.status}.`);
    return parsePriceCharting(await response.text(), 40);
  });
}

type BrowseItem = { title?: string; price?: { value?: string; currency?: string }; itemWebUrl?: string; itemAffiliateWebUrl?: string };

function ebaySearchUrl(card: CnCard) {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.q)}&LH_BIN=1`;
}

function ebayListings(card: CnCard): Promise<ListingLike[]> {
  return cached(`cnbinder:ebay:v1:${card.id}`, TTL, async () => {
    const url = new URL(EBAY_SEARCH);
    url.searchParams.set("q", card.q);
    url.searchParams.set("limit", "100");
    url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},priceCurrency:USD");
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${await accessToken()}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    };
    if (process.env.EBAY_CAMPAIGN_ID) headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${process.env.EBAY_CAMPAIGN_ID}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`eBay answered ${response.status}.`);
    const data = (await response.json()) as { itemSummaries?: BrowseItem[] };
    return (data.itemSummaries ?? []).flatMap((item): ListingLike[] => {
      const price = Number(item.price?.value);
      const link = item.itemAffiliateWebUrl || item.itemWebUrl;
      return item.title && link && item.price?.currency === "USD" && price > 0 ? [{ title: item.title.slice(0, 160), price, url: link }] : [];
    });
  });
}

// History lives in KV when it is configured; otherwise in memory, which only lasts as long as one server instance.
const memoryHistory = new Map<string, HistoryPoint[]>();
const historyKey = (id: string) => `cnbinder:hist:v1:${id}`;

async function readHistory(): Promise<Record<string, HistoryPoint[]>> {
  const out: Record<string, HistoryPoint[]> = {};
  if (hasKvEnvironment()) {
    try {
      const values = await kv.mget<(HistoryPoint[] | null)[]>(...CARDS.map((c) => historyKey(c.id)));
      CARDS.forEach((card, i) => { out[card.id] = Array.isArray(values[i]) ? values[i]! : []; });
      return out;
    } catch {}
  }
  for (const card of CARDS) out[card.id] = memoryHistory.get(card.id) ?? [];
  return out;
}

async function writeHistory(id: string, history: HistoryPoint[]) {
  memoryHistory.set(id, history);
  if (!hasKvEnvironment()) return;
  try { await kv.set(historyKey(id), history); } catch {}
}

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]);
    }
  }));
  return results;
}

let inflight: Promise<MarketResponse> | null = null;

/** Every card's prices, trend and recent sales. Concurrent callers share one load. */
export function loadMarket(): Promise<MarketResponse> {
  if (!inflight) inflight = buildMarket().finally(() => { inflight = null; });
  return inflight;
}

async function buildMarket(): Promise<MarketResponse> {
  const today = isoDay(Date.now());
  const [useEbay, histories] = await Promise.all([ebayReady(), readHistory()]);
  let pcWorked = false;

  const cards = await pool(CARDS, 6, async (card): Promise<CardMarket> => {
    const errors: string[] = [];
    let pc: PriceChartingData | null = null;
    try {
      pc = await priceCharting(card);
      pcWorked = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "PriceCharting could not be reached.");
    }

    let ask: CardMarket["ask"] = null;
    if (useEbay) {
      try {
        const matches = rawAsking(await ebayListings(card), card.must, excludedWords(card), pc?.ungraded ?? null);
        const summary = summarizeAsking(matches);
        ask = summary ? { ...summary, search: ebaySearchUrl(card) } : null;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "eBay could not be reached.");
      }
    }

    let history = histories[card.id] ?? [];
    if (pc || ask) {
      const point: HistoryPoint = { d: today, raw: pc?.ungraded ?? null, psa: pc?.psa10 ?? null, ask: ask?.median ?? null, n: ask?.count ?? null };
      const last = history[history.length - 1];
      if (!last || last.d !== today) {
        history = addHistory(history, point, HISTORY_DAYS);
        await writeHistory(card.id, history);
      }
    }

    return {
      id: card.id,
      pc: pc ? { ungraded: pc.ungraded, grade9: pc.grade9, psa10: pc.psa10, url: PC_BASE + card.pc } : null,
      trend: bestTrend(pc, history, today),
      askTrend: trackedTrend(history, "ask", today, "asking"),
      sold: {
        raw: pc ? recentSales(pc.raw, today, 60).slice(-30) : [],
        psa10: pc ? recentSales(pc.graded10, today, 60).slice(-30) : [],
      },
      ask,
      history: history.slice(-30),
      errors,
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    today,
    sources: { pricecharting: pcWorked, ebay: useEbay, history: hasKvEnvironment() },
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
  };
}
