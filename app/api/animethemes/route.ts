import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return Response.json({ error: "No slug provided" }, { status: 400 });

  const res = await fetch(
    `https://api.animethemes.moe/anime?filter[slug]=${encodeURIComponent(slug)}&include=animethemes.animethemeentries.videos,animethemes.song`,
    {
      headers: { "User-Agent": "animedraft-quiz/1.0" },
      next: { revalidate: 3600 },
    }
  );

  if (!res.ok) {
    return Response.json({ error: "AnimeThemes API error" }, { status: 502 });
  }

  const data = await res.json();
  const anime = data.anime?.[0];
  if (!anime) return Response.json({ error: "Anime not found" }, { status: 404 });

  // Prefer first OP, fall back to first theme of any type
  const op =
    anime.animethemes?.find((t: { type: string }) => t.type === "OP") ??
    anime.animethemes?.[0];
  if (!op) return Response.json({ error: "No themes found" }, { status: 404 });

  const video = op.animethemeentries?.[0]?.videos?.[0];
  if (!video?.link) return Response.json({ error: "No video link" }, { status: 404 });

  return Response.json({
    animeName: anime.name,
    slug: anime.slug,
    themeSlug: op.slug ?? op.type,
    songTitle: op.song?.title ?? null,
    videoUrl: video.link,
  });
}
