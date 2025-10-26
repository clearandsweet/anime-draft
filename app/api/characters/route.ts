export const dynamic = "force-dynamic";

const ANILIST_URL = "https://graphql.anilist.co";

const QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      characters(sort: FAVOURITES_DESC) {
        id
        name { full native }
        gender
        image { large medium }
        favourites
      }
    }
  }
`;

async function fetchCharPage(page: number, perPage = 100) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { page, perPage },
    }),
  });

  if (!res.ok) {
    throw new Error(`AniList page ${page} failed with ${res.status}`);
  }

  const data = await res.json();
  return data?.data?.Page?.characters ?? [];
}

export async function GET() {
  try {
    const allChars: any[] = [];
    const perPage = 100;
    const maxPages = 30; // ~3000 characters, safer for Vercel

    for (let page = 1; page <= maxPages; page++) {
      const chunk = await fetchCharPage(page, perPage);
      if (!chunk.length) break;
      allChars.push(...chunk);
    }

    const characters = allChars.map((c) => ({
      id: c.id,
      name: {
        full: c.name?.full ?? "",
        native: c.name?.native ?? "",
      },
      gender: c.gender ?? "Unknown",
      image: { large: c.image?.large ?? "" },
      favourites: c.favourites ?? 0,
    }));

    characters.sort(
      (a, b) => (b.favourites || 0) - (a.favourites || 0)
    );

    return new Response(JSON.stringify({ characters }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("characters GET failed:", err);
    return new Response(
      JSON.stringify({
        error: err?.message ?? "Character fetch failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
