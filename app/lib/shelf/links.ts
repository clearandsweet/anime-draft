/** Links out: a figure's MyFigureCollection page, and prefilled searches on shops the shelf can't read. */
const MFC_ITEM = /^https:\/\/myfigurecollection\.net\/item\/\d+$/;

/** A known MFC item page, or MFC's quick search, which opens the item on a unique match. */
export function mfcLink(figure: { name: string; url?: string; mfcUrl?: string; mfcQuery?: string }) {
  const direct = [figure.mfcUrl, figure.url].find((url) => MFC_ITEM.test(url ?? ""));
  return direct
    ? { href: direct, direct: true }
    : { href: `https://myfigurecollection.net/?_tb=item&keywords=${encodeURIComponent(figure.mfcQuery || figure.name)}`, direct: false };
}

/** MFC search words for a shop listing: its title without the maker, brackets or dashes. */
export function mfcQuery(title: string) {
  return title
    .replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, " ")
    .replace(/\s[-–]\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shopSearches(query: string) {
  const q = encodeURIComponent(query);
  return [
    { label: "MyFigureCollection", href: `https://myfigurecollection.net/?_tb=item&keywords=${q}` },
    { label: "eBay", href: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${query} figure`)}` },
    { label: "Mandarake", href: `https://order.mandarake.co.jp/order/listPage/list?keyword=${q}&lang=en` },
    { label: "AmiAmi", href: `https://www.amiami.com/eng/search/list/?s_keywords=${q}` },
    { label: "Solaris Japan", href: `https://solarisjapan.com/search?q=${q}&type=product` },
  ];
}
