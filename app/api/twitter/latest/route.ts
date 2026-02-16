import { NextResponse } from "next/server";

export const runtime = "nodejs";

const RSS_URL = "https://twitrss.me/twitter_user_to_rss/?user=clearandsweet";

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
      const link = takeTag(block, "link");
      const pubDate = takeTag(block, "pubDate");
      if (!title || !link) return null;
      if (title.startsWith("RT @")) return null;
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
    const res = await fetch(RSS_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Twitter feed unavailable." }, { status: 502 });
    }
    const xml = await res.text();
    const tweets = parseItems(xml);

    return NextResponse.json(
      { tweets, fetchedAt: new Date().toISOString() },
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

