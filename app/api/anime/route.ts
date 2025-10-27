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

type AniListMedia = {
  id: number;
  title?: {
    english?: string | null;
    romaji?: string | null;
    native?: string | null;
  };
  coverImage?: {
    large?: string | null;
    medium?: string | null;
    color?: string | null;
  };
  seasonYear?: number | null;
  format?: string | null;
  popularity?: number | null;
  episodes?: number | null;
  genres?: string[] | null;
};

type AniListResponse = {
  data?: {
    Page?: {
      media?: AniListMedia[];
    };
  };
};

type NormalizedAnime = {
  id: number;
  title: {
    english: string;
    romaji: string;
    native: string;
  };
  coverImage: {
    large: string;
  };
  seasonYear: number;
  format: string;
  popularity: number;
  episodes: number;
  genres: string[];
};

async function fetchPage(page: number, perPage = 50): Promise<AniListMedia[]> {
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

  const data = (await res.json()) as AniListResponse;
  return data?.data?.Page?.media ?? [];
}

function normalize(media: AniListMedia[]): NormalizedAnime[] {
  return media.map((m) => ({
    id: m.id,
    title: {
      english: m.title?.english ?? "",
      romaji: m.title?.romaji ?? "",
      native: m.title?.native ?? "",
    },
    coverImage: {
      large: m.coverImage?.large ?? "",
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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "AniList fetch failed";
    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
