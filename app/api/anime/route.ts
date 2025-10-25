export const dynamic = "force-dynamic"; // don't cache

const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: POPULARITY_DESC, type: ANIME) {
        id
        title {
          english
          romaji
          native
        }
        coverImage {
          large
          medium
          color
        }
        seasonYear
        format
        popularity
        episodes
        genres
      }
    }
  }
`;

async function fetchPage(page: number, perPage = 50) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { page, perPage },
    }),
  });

  if (!res.ok) {
    throw new Error(`AniList fetch failed ${res.status}`);
  }

  const data = await res.json();
  return data?.data?.Page?.media ?? [];
}

function normalize(media: any[]) {
  return media.map((m: any) => ({
    id: m.id,
    title: {
      english: m.title.english ?? "",
      romaji: m.title.romaji ?? "",
      native: m.title.native ?? "",
    },
    coverImage: {
      large: m.coverImage.large,
    },
    seasonYear: m.seasonYear ?? 0,
    format: m.format ?? "",
    popularity: m.popularity ?? 0,
    episodes: m.episodes ?? 0,
    genres: m.genres ?? [],
  }));
}

// this handles GET /api/anime
export async function GET() {
  try {
    // fetch ~200 anime (4x50)
    const pages = await Promise.all([
      fetchPage(1),
      fetchPage(2),
      fetchPage(3),
      fetchPage(4),
    ]);

    const all = pages.flat();
    const top200 = all.slice(0, 200);
    const normalized = normalize(top200);

    // sort highest popularity first just to be safe
    normalized.sort(
      (a, b) => (b.popularity || 0) - (a.popularity || 0)
    );

    return new Response(JSON.stringify({ anime: normalized }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err?.message ?? "AniList fetch failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
