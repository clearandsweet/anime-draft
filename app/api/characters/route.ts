import { anilistRequest, anilistErrorResponse } from "../../lib/anilist";
// app/api/characters/route.ts

export const dynamic = "force-dynamic";

type AniListCharacter = {
  id: number;
  name?: {
    full?: string | null;
    native?: string | null;
  };
  gender?: string | null;
  image?: {
    large?: string | null;
  };
  favourites?: number | null;
};

type AniListCharacterResponse = {
  data?: {
    Page?: {
      characters?: AniListCharacter[];
      pageInfo?: { hasNextPage: boolean };
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pageParam = searchParams.get("page") || "1";
  const page = Number(pageParam);
  if (!Number.isInteger(page) || page < 1 || page > 200) {
    return Response.json({ error: "Page must be an integer from 1 to 200." }, { status: 400 });
  }

  // AniList GraphQL query for characters ordered by favourites desc
  // We request, say, 50 per page
  const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        characters(sort: FAVOURITES_DESC) {
          id
          name {
            full
            native
          }
          gender
          image {
            large
          }
          favourites
        }
      }
    }
  `;

  const variables = { page };

  try {
    const json = await anilistRequest<AniListCharacterResponse>(query, variables, 3_600_000);

    // <- THIS IS IMPORTANT: shape must match what page.tsx expects
    const characters: NormalizedCharacter[] =
      json?.data?.Page?.characters?.map((c) => ({
        id: c.id,
        name: {
          full: c?.name?.full ?? "",
          native: c?.name?.native ?? "",
        },
        gender: c?.gender ?? "Unknown",
        image: {
          large: c?.image?.large ?? "",
        },
        favourites: c?.favourites ?? 0,
      })) ?? [];

    return new Response(
      JSON.stringify({ characters, hasNextPage: json.data?.Page?.pageInfo?.hasNextPage ?? characters.length === 50 }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (err: unknown) {
    return anilistErrorResponse(err);
  }
}
