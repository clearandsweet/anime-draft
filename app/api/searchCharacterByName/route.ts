import { anilistRequest, anilistErrorResponse } from "../../lib/anilist";
export const dynamic = "force-dynamic";



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

type AniListSearchCharacter = {
  id: number;
  name?: { full?: string | null; native?: string | null };
  gender?: string | null;
  image?: { large?: string | null; medium?: string | null };
  favourites?: number | null;
};

type AniListSearchResponse = {
  data?: {
    Page?: {
      characters?: AniListSearchCharacter[];
    };
  };
};

type NormalizedCharacter = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

async function searchAniListByName(term: string): Promise<NormalizedCharacter[]> {
  const data = await anilistRequest<AniListSearchResponse>(SEARCH_QUERY, { search: term });
  const chars = data?.data?.Page?.characters ?? [];

    return chars.map((c) => ({
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

    if (q.trim().length > 100) return Response.json({ error: "Search must be 100 characters or fewer." }, { status: 400 });
    const found = await searchAniListByName(q.trim());

    return new Response(
      JSON.stringify({ characters: found }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    return anilistErrorResponse(err);
  }
}
