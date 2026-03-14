export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Search Pokemon by name or Pokédex number directly via PokeAPI.
// Used as fallback for Pokemon not yet loaded in the client pool,
// and for exact-match lookups.

type NormalizedPokemon = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

const POKEAPI_BASE = "https://pokeapi.co/api/v2";

function getGeneration(id: number): string {
  if (id <= 151) return "Gen 1";
  if (id <= 251) return "Gen 2";
  if (id <= 386) return "Gen 3";
  if (id <= 493) return "Gen 4";
  if (id <= 649) return "Gen 5";
  if (id <= 721) return "Gen 6";
  if (id <= 809) return "Gen 7";
  if (id <= 905) return "Gen 8";
  if (id <= 1025) return "Gen 9";
  return "Form";
}

function getImageUrl(id: number): string {
  if (id >= 1 && id <= 1025) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPokemonName(apiName: string): string {
  const parts = apiName.split("-");
  const base = capitalize(parts[0]);
  if (parts.length === 1) return base;
  const rest = parts.slice(1);

  if (rest.includes("mega")) {
    const suffix = rest.filter((p) => p !== "mega").map((p) => p.toUpperCase());
    return suffix.length ? `Mega ${base} ${suffix.join(" ")}` : `Mega ${base}`;
  }
  if (rest[rest.length - 1] === "gmax") {
    const formParts = rest.slice(0, -1);
    return formParts.length
      ? `${base} (${formParts.map(capitalize).join(" ")} Gigantamax)`
      : `${base} (Gigantamax)`;
  }
  const regionMap: Record<string, string> = {
    alola: "Alolan", galar: "Galarian", hisui: "Hisuian", paldea: "Paldean",
  };
  for (const [key, label] of Object.entries(regionMap)) {
    const idx = rest.indexOf(key);
    if (idx >= 0) {
      const extra = rest.filter((_, i) => i !== idx);
      return extra.length
        ? `${label} ${base} (${extra.map(capitalize).join(" ")})`
        : `${label} ${base}`;
    }
  }
  return `${base} (${rest.map(capitalize).join(" ")})`;
}

async function fetchSinglePokemon(nameOrId: string): Promise<NormalizedPokemon | null> {
  try {
    const res = await fetch(`${POKEAPI_BASE}/pokemon/${nameOrId.toLowerCase().trim()}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();

    const id: number = data.id;
    const apiName: string = data.name;
    const types: string[] = (data.types ?? []).map(
      (t: { type: { name: string } }) => capitalize(t.type.name)
    );

    return {
      id,
      name: {
        full: formatPokemonName(apiName),
        native: types.join(" / ") || "Unknown",
      },
      gender: getGeneration(id),
      image: {
        large:
          data.sprites?.other?.["official-artwork"]?.front_default ||
          data.sprites?.front_default ||
          getImageUrl(id),
      },
      favourites: id <= 1025 ? Math.max(1, 1026 - id) : 0,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return Response.json({ error: "Missing query parameter ?q=" }, { status: 400 });
  }

  try {
    // If query is a number, fetch by Pokédex ID
    const asNumber = parseInt(q, 10);
    if (!Number.isNaN(asNumber) && asNumber > 0) {
      const result = await fetchSinglePokemon(String(asNumber));
      return Response.json({ pokemon: result ? [result] : [] });
    }

    // Otherwise search by name (exact match via PokeAPI)
    const result = await fetchSinglePokemon(q.toLowerCase().replace(/\s+/g, "-"));
    if (result) return Response.json({ pokemon: [result] });

    // If not found with hyphens, try the raw query
    const result2 = await fetchSinglePokemon(q.toLowerCase());
    return Response.json({ pokemon: result2 ? [result2] : [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Search failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
