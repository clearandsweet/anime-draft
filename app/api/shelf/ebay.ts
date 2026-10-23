import type { EbayItem } from "../../lib/shelf/ebay";
import { cached } from "./cache";

// eBay's Browse API with an application token (client credentials). Set EBAY_CLIENT_ID and
// EBAY_CLIENT_SECRET from a production keyset; EBAY_CAMPAIGN_ID adds eBay Partner Network links.
const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const SCOPE = "https://api.ebay.com/oauth/api_scope";

export const ebayConfigured = () => Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);

let token: { value: string; expires: number } | null = null;

async function accessToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`eBay sign-in failed (${response.status}).`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return token.value;
}

const slim = (item: EbayItem): EbayItem => ({
  itemId: item.itemId,
  title: item.title,
  price: item.price ? { value: item.price.value, currency: item.price.currency } : null,
  image: item.image?.imageUrl ? { imageUrl: item.image.imageUrl } : null,
  thumbnailImages: item.thumbnailImages?.[0]?.imageUrl ? [{ imageUrl: item.thumbnailImages[0].imageUrl }] : null,
  condition: item.condition ?? null,
  itemWebUrl: item.itemWebUrl,
  itemAffiliateWebUrl: item.itemAffiliateWebUrl ?? null,
  itemLocation: item.itemLocation?.country ? { country: item.itemLocation.country } : null,
});

/** 50 buy-it-now listings for a franchise, cached for half a day (eBay allows 5,000 searches a day). */
export function searchEbay(query: string): Promise<EbayItem[]> {
  return cached(`shelf:ebay:v1:${query}`, 12 * 3600, async () => {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("q", `${query} figure`);
    url.searchParams.set("limit", "50");
    url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},price:[15..],priceCurrency:USD");
    if (process.env.EBAY_CATEGORY_IDS) url.searchParams.set("category_ids", process.env.EBAY_CATEGORY_IDS);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${await accessToken()}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    };
    if (process.env.EBAY_CAMPAIGN_ID) headers["X-EBAY-C-ENDUSERCTX"] = `affiliateCampaignId=${process.env.EBAY_CAMPAIGN_ID}`;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`eBay answered ${response.status}.`);
    const data = (await response.json()) as { itemSummaries?: EbayItem[] };
    return (data.itemSummaries ?? []).map(slim);
  });
}
