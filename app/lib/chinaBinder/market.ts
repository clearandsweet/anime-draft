/** Price data for the China-only binder: PriceCharting's record of eBay sales, live eBay asking prices, and the 14-day moves between them. Pure functions only. */

export type Sale = { date: string; price: number; title: string; url: string | null };

export type PriceChartingData = {
  ungraded: number | null;
  grade9: number | null;
  psa10: number | null;
  raw: Sale[];
  graded10: Sale[];
};

export type AskingSummary = { median: number; low: number; count: number; sample: { title: string; price: number; url: string }[] };

export type HistoryPoint = { d: string; raw?: number | null; psa?: number | null; ask?: number | null; n?: number | null };

export type Direction = "up" | "down" | "flat" | "none";

export type Trend = {
  dir: Direction;
  /** Which price moved: ungraded copies or PSA 10s. */
  grade: "raw" | "psa10";
  pct: number | null;
  basis: "sold" | "tracked" | "asking" | null;
  now: number | null;
  before: number | null;
  nNow: number;
  nBefore: number;
  label: string;
};

export const TREND_DAYS = 14;
/** Moves smaller than this are reported as flat. */
export const FLAT_PCT = 2;
/** Sales needed in each window before sold prices set the direction. */
export const MIN_SALES = 2;

const DAY = 86_400_000;

const decode = (text: string) =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const money = (text: string | undefined | null): number | null => {
  if (!text) return null;
  const value = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
};

function cellPrice(html: string, id: string) {
  const match = html.match(new RegExp(`<td id="${id}"[^>]*>\\s*<span class="price js-price">([^<]*)<`));
  return money(match?.[1]);
}

function salesTable(html: string, kind: string, limit: number): Sale[] {
  const start = html.indexOf(`<div class="completed-auctions-${kind}"`);
  if (start < 0) return [];
  const end = html.indexOf("</table>", start);
  const block = html.slice(start, end < 0 ? undefined : end);
  const sales: Sale[] = [];
  for (const row of block.match(/<tr[^>]*id="ebay-[^"]*"[\s\S]*?<\/tr>/g) ?? []) {
    const date = row.match(/<td class="date">\s*(\d{4}-\d{2}-\d{2})\s*<\/td>/)?.[1];
    const priceCell = row.match(/<td class="numeric">\s*<span class="js-price"\s*>([^<]*)</);
    const price = money(priceCell?.[1]);
    if (!date || !price) continue;
    const link = row.match(/<a[^>]*class="js-ebay-completed-sale"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const item = link?.[1].match(/ebay\.com\/itm\/(\d+)/)?.[1];
    sales.push({ date, price, title: link ? decode(link[2]).slice(0, 160) : "", url: item ? `https://www.ebay.com/itm/${item}` : null });
    if (sales.length >= limit) break;
  }
  return sales;
}

/** A PriceCharting card page: its headline prices and the eBay sales behind them (newest first). */
export function parsePriceCharting(html: string, limit = 40): PriceChartingData {
  return {
    ungraded: cellPrice(html, "used_price"),
    grade9: cellPrice(html, "graded_price"),
    psa10: cellPrice(html, "manual_only_price"),
    raw: salesTable(html, "used", limit),
    graded10: salesTable(html, "manual-only", limit),
  };
}

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
export const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

function describe(pct: number | null, days = TREND_DAYS) {
  if (pct === null) return "Not enough data yet";
  if (Math.abs(pct) < FLAT_PCT) return `Flat over ${days} days`;
  return `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct).toFixed(1)}% over ${days} days`;
}

function direction(pct: number | null): Direction {
  if (pct === null) return "none";
  if (Math.abs(pct) < FLAT_PCT) return "flat";
  return pct > 0 ? "up" : "down";
}

const percent = (now: number, before: number) => Math.round(((now - before) / before) * 1000) / 10;

const empty = (basis: Trend["basis"] = null, grade: Trend["grade"] = "raw"): Trend => ({ dir: "none", grade, pct: null, basis, now: null, before: null, nNow: 0, nBefore: 0, label: describe(null) });

/** Median sale in the last 14 days against the 14 days before. Needs a sale in each window. */
export function soldTrend(sales: Sale[], today: string, grade: Trend["grade"] = "raw", days = TREND_DAYS): Trend {
  const end = dayNumber(today);
  const recent: number[] = [];
  const prior: number[] = [];
  for (const sale of sales) {
    const age = end - dayNumber(sale.date);
    if (age < 0) continue;
    if (age < days) recent.push(sale.price);
    else if (age < days * 2) prior.push(sale.price);
  }
  const now = median(recent);
  const before = median(prior);
  if (now === null || before === null || recent.length < MIN_SALES || prior.length < MIN_SALES) return { ...empty("sold", grade), now, before, nNow: recent.length, nBefore: prior.length };
  const pct = percent(now, before);
  return { dir: direction(pct), grade, pct, basis: "sold", now, before, nNow: recent.length, nBefore: prior.length, label: describe(pct, days) };
}

/** A tracked daily value against its reading closest to 14 days earlier (at least 10 days back). */
export function trackedTrend(history: HistoryPoint[], field: "raw" | "psa" | "ask", today: string, basis: "tracked" | "asking", days = TREND_DAYS): Trend {
  const end = dayNumber(today);
  const points = history
    .map((p) => ({ age: end - dayNumber(p.d), value: p[field] ?? null }))
    .filter((p): p is { age: number; value: number } => p.value !== null && p.value > 0 && p.age >= 0);
  const latest = points.sort((a, b) => a.age - b.age)[0];
  const older = points.filter((p) => p.age >= 10).sort((a, b) => Math.abs(a.age - days) - Math.abs(b.age - days))[0];
  const grade = field === "psa" ? "psa10" : "raw";
  if (!latest || !older || latest.age > 3) return empty(basis, grade);
  const pct = percent(latest.value, older.value);
  return { dir: direction(pct), grade, pct, basis, now: latest.value, before: older.value, nNow: 1, nBefore: 1, label: describe(pct, older.age - latest.age) };
}

/** Sold prices first (raw, then PSA 10), then PriceCharting's tracked price, then eBay asking prices. */
export function bestTrend(pc: PriceChartingData | null, history: HistoryPoint[], today: string): Trend {
  const candidates: Trend[] = [];
  if (pc) {
    candidates.push(soldTrend(pc.raw, today, "raw"));
    candidates.push(soldTrend(pc.graded10, today, "psa10"));
  }
  candidates.push(trackedTrend(history, "raw", today, "tracked"));
  candidates.push(trackedTrend(history, "ask", today, "asking"));
  return candidates.find((t) => t.pct !== null) ?? candidates[0] ?? empty();
}

/** Sales in the last `days` days, oldest first, for the chart. */
export function recentSales(sales: Sale[], today: string, days = 60): Sale[] {
  const end = dayNumber(today);
  return sales.filter((s) => {
    const age = end - dayNumber(s.date);
    return age >= 0 && age < days;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// ---- eBay asking prices -------------------------------------------------------------------

export type ListingLike = { title: string; price: number; url: string };

const GRADED = /\b(psa|cgc|bgs|beckett|tag|ace|sgc|graded|slab|slabbed|gem mint 10|pristine)\b/;
const JUNK = /\b(proxy|custom|orica|fan ?art|replica|reprint|metal|gold card|acrylic|sticker|poster|playmat|sleeve|lot|bundle|set of|complete set|sealed|booster box|booster pack|display|empty|code card|choose|pick your|you pick|random)\b/;
const CHINESE = /\b(chinese|s ?chinese|simplified|sc|cn|china|csv\d+(?:\.\d)?c?|cbb\d+c?|gem pack)\b/;

export const normalizeTitle = (text: string) => ` ${text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
const hasWord = (title: string, word: string) => title.includes(normalizeTitle(word));

/**
 * Raw (ungraded) asking prices for one card. A listing has to name the card (every `must` group),
 * look Chinese, and carry none of the excluded words. Prices far from PriceCharting's raw price
 * are dropped when that price is known, since they are usually a different card or a lot.
 */
export function rawAsking(items: ListingLike[], must: string[][], excluded: string[], anchor: number | null): ListingLike[] {
  return items.filter((item) => {
    const title = normalizeTitle(item.title);
    if (!(item.price > 0)) return false;
    if (GRADED.test(title) || JUNK.test(title) || !CHINESE.test(title)) return false;
    if (excluded.some((word) => hasWord(title, word))) return false;
    if (!must.every((group) => group.some((word) => hasWord(title, word)))) return false;
    if (anchor && (item.price < anchor * 0.35 || item.price > anchor * 4)) return false;
    return true;
  });
}

export function summarizeAsking(items: ListingLike[]): AskingSummary | null {
  if (!items.length) return null;
  const prices = items.map((i) => i.price);
  const sorted = [...items].sort((a, b) => a.price - b.price);
  return {
    median: median(prices)!,
    low: sorted[0].price,
    count: items.length,
    sample: sorted.slice(0, 5).map((i) => ({ title: i.title.slice(0, 120), price: i.price, url: i.url })),
  };
}

/** Appends today's reading (replacing an earlier one from today) and keeps the last `keep` days. */
export function addHistory(history: HistoryPoint[], point: HistoryPoint, keep = 60): HistoryPoint[] {
  const rest = history.filter((p) => p.d !== point.d);
  return [...rest, point].sort((a, b) => a.d.localeCompare(b.d)).slice(-keep);
}
