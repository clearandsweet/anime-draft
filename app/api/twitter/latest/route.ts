import { NextResponse } from "next/server";

export const runtime = "nodejs";

const RSS_SOURCES = [
  "https://twitrss.me/twitter_user_to_rss/?user=clearandsweet",
  "https://nitter.net/clearandsweet/rss",
];

type TweetItem = {
  id: string;
  text: string;
  url: string;
  publishedAt: string;
};

function decodeXml(input: string) {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function takeTag(block: string, tag: string) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m?.[1]?.trim() ?? "";
}

function normalizeTweetText(raw: string) {
  const withoutLinks = raw.replace(/https?:\/\/\S+/g, "").trim();
  return decodeXml(withoutLinks);
}

function parseItems(xml: string): TweetItem[] {
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const parsed = matches
    .map((m) => {
      const block = m[1] ?? "";
      const title = normalizeTweetText(takeTag(block, "title"));
      const rawLink = takeTag(block, "link");
      const pubDate = takeTag(block, "pubDate");
      const guid = takeTag(block, "guid");
      if (!title || !rawLink) return null;
      if (title.startsWith("RT @") || title.startsWith("RT by @")) return null;

      const statusIdMatch =
        rawLink.match(/status\/(\d+)/)?.[1] ??
        guid.match(/(\d{6,})/)?.[1] ??
        "";
      const link = statusIdMatch
        ? `https://x.com/clearandsweet/status/${statusIdMatch}`
        : rawLink;

      return {
        id: link,
        text: title,
        url: link,
        publishedAt: pubDate,
      };
    })
    .filter((v): v is TweetItem => Boolean(v));

  return parsed.slice(0, 12);
}

export async function GET() {
  try {
    let xml = "";
    let sourceUsed = "";

    for (const source of RSS_SOURCES) {
      const res = await fetch(source, { cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) continue;
      xml = await res.text();
      sourceUsed = source;
      if (xml.includes("<item>")) break;
    }

    if (!xml) {
      return NextResponse.json({ error: "Twitter feed unavailable." }, { status: 502 });
    }

    const tweets = parseItems(xml);

    return NextResponse.json(
      { tweets, fetchedAt: new Date().toISOString(), sourceUsed },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("twitter latest feed error:", err);
    return NextResponse.json({ error: "Twitter feed server error." }, { status: 500 });
  }
}
