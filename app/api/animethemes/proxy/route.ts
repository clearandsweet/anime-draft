import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new Response("No URL", { status: 400 });

  // Restrict to AnimeThemes CDN only
  if (!url.startsWith("https://v.animethemes.moe/")) {
    return new Response("URL not allowed", { status: 403 });
  }

  const upstream = await fetch(url, {
    headers: { "User-Agent": "animedraft-quiz/1.0" },
  });

  if (!upstream.ok) {
    return new Response("Upstream fetch failed", { status: upstream.status });
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? "video/webm",
    "Access-Control-Allow-Origin": "*",
  });
  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { headers });
}
