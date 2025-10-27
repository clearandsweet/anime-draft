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
  const page = parseInt(pageParam, 10) || 1;

  // AniList GraphQL query for characters ordered by favourites desc
  // We request, say, 50 per page
  const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 50) {
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
    const result = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          error: "AniList request failed",
          status: result.status,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const json = (await result.json()) as AniListCharacterResponse;

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
      JSON.stringify({ characters }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "AniList fetch threw";
    return new Response(
      JSON.stringify({
        error: "AniList fetch threw",
        message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
