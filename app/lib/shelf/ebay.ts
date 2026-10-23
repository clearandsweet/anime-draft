/** eBay listings (Browse API item summaries) matched to one franchise: the secondhand market for any figure, any year. */
import { mfcLink, mfcQuery } from "./links.ts";
import { classifyFigure, findCharacters, normalize, titleMatch } from "./match.ts";
import type { CatalogShow, ShelfFigure } from "./types.ts";

export type EbayItem = {
  itemId: string;
  title: string;
  price?: { value?: string; currency?: string } | null;
  image?: { imageUrl?: string } | null;
  thumbnailImages?: { imageUrl?: string }[] | null;
  condition?: string | null;
  itemWebUrl: string;
  itemAffiliateWebUrl?: string | null;
  itemLocation?: { country?: string } | null;
};

// Knock-offs announce themselves often enough to drop; most come from these sellers' countries.
const KNOCKOFF = /\b(bootleg|replica|knockoff|knock off|copy ver|3d print(?:ed)?|gk statue|resin statue|custom made|unofficial)\b/;
const KNOCKOFF_COUNTRIES = new Set(["CN", "HK"]);

export function matchEbay(items: EbayItem[], show: CatalogShow): ShelfFigure[] {
  const castNames = new Map(show.cast.map((member) => [member.key, member.name]));
  const figures: ShelfFigure[] = [];
  for (const item of items) {
    const text = normalize(item.title);
    const country = item.itemLocation?.country ?? "";
    if (KNOCKOFF.test(text) || KNOCKOFF_COUNTRIES.has(country)) continue;
    const price = Number(item.price?.value);
    if (item.price?.currency !== "USD" || !(price > 0)) continue;
    const kind = classifyFigure(item.title);
    if (!kind) continue;
    // The search was for this franchise, so naming either the show or one of its characters is enough.
    const title = titleMatch(text, show.terms);
    const chars = findCharacters(title ? ` ${text} `.replace(` ${title.title} `, " ") : text, show.cast);
    if (!title && !chars.length) continue;
    const link = mfcLink({ name: item.title, mfcQuery: mfcQuery(item.title) });
    figures.push({
      id: `ebay:${item.itemId}`,
      show: show.id,
      name: item.title,
      line: kind.line,
      maker: "",
      tier: kind.tier,
      chars: chars.length ? chars : ["unknown"],
      charNames: chars.map((key) => castNames.get(key) ?? key),
      price: Math.round(price * 100) / 100,
      cond: /^new/i.test(item.condition ?? "") ? "new" : "pre-owned",
      avail: "in stock",
      source: "eBay",
      url: item.itemAffiliateWebUrl || item.itemWebUrl,
      img: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || null,
      mfcHref: link.href,
      mfcDirect: link.direct,
      note: [item.condition, country ? `ships from ${country}` : "", "plus shipping"].filter(Boolean).join(" · "),
    });
  }
  return figures;
}
