import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CHANNEL_ID = "UCSgEt1phs8Irk5tknTTdSag";
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

type FeedVideo = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
};

function decodeXml(input: string) {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function extractTag(block: string, tag: string) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const match = block.match(regex);
  return match?.[1]?.trim() ?? "";
}

function parseFeed(xml: string): FeedVideo[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  return entries
    .map((entryMatch) => {
      const block = entryMatch[1] ?? "";
      const id = extractTag(block, "yt:videoId");
      const rawTitle = extractTag(block, "title");
      const publishedAt = extractTag(block, "published");
      const thumbnail =
        block.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1] ??
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      if (!id || !rawTitle) return null;
      return {
        id,
        title: decodeXml(rawTitle),
        publishedAt,
        thumbnail,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    })
    .filter((v): v is FeedVideo => Boolean(v))
    .slice(0, 18);
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to load YouTube feed." },
        { status: 502 }
      );
    }
    const xml = await res.text();
    const videos = parseFeed(xml);
    return NextResponse.json(
      {
        videos,
        fetchedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("youtube latest feed error:", err);
    return NextResponse.json(
      { error: "Server error loading YouTube feed." },
      { status: 500 }
    );
  }
}

