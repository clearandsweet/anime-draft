export const dynamic = "force-dynamic";

const ANILIST_URL = "https://graphql.anilist.co";

const SEARCH_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 10) {
      characters(search: $search, sort: FAVOURITES_DESC) {
        id
        name { full native }
        gender
        image { large medium }
        favourites
      }
    }
  }
`;

async function searchAniListByName(term: string) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { search: term },
    }),
  });

  if (!res.ok) {
    throw new Error(`AniList search failed ${res.status}`);
  }

  const data = await res.json();
  const chars = data?.data?.Page?.characters ?? [];

  return chars.map((c: any) => ({
    id: c.id,
    name: {
      full: c.name?.full ?? "",
      native: c.name?.native ?? "",
    },
    gender: c.gender ?? "Unknown",
    image: { large: c.image?.large ?? "" },
    favourites: c.favourites ?? 0,
  }));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    if (!q.trim()) {
      return new Response(
        JSON.stringify({ characters: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const found = await searchAniListByName(q.trim());

    return new Response(
      JSON.stringify({ characters: found }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("searchCharacterByName GET failed:", err);
    return new Response(
        JSON.stringify({
          error: err?.message ?? "search failed",
          characters: [],
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
  }
}
