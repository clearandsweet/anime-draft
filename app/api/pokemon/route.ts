export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Normalized shape matches the Character type used by the lobby system:
//   id          → Pokédex/form ID
//   name.full   → Display name ("Charizard", "Mega Charizard X", "Alolan Raichu")
//   name.native → Types string ("Fire / Flying")
//   gender      → Generation string ("Gen 1", "Gen 2", … "Form")
//   image.large → Image URL
//   favourites  → Rough popularity proxy (higher for earlier gens)

type NormalizedPokemon = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

// Module-level cache — survives across requests on a warm instance
let pokemonCache: NormalizedPokemon[] | null = null;
let cacheBuilding: Promise<NormalizedPokemon[]> | null = null;

const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// PokeAPI returns ~1300 Pokemon including alternate forms when limit=2000
const POKEMON_LIMIT = 2000;

const TYPE_NAMES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

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
  // Official artwork exists for base Pokemon (1–1025); forms use front sprites
  if (id >= 1 && id <= 1025) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

// Popularity proxy: higher = more "popular" (earlier gens bias)
function getPopularityScore(id: number): number {
  if (id > 1025) return 0; // forms get 0
  // Gen 1 scores 875–1025, Gen 2 scores 775–874, etc.
  return Math.max(1, 1026 - id);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPokemonName(apiName: string): string {
  const parts = apiName.split("-");
  const base = capitalize(parts[0]);

  if (parts.length === 1) return base;

  const rest = parts.slice(1);

  // Mega evolutions: "venusaur-mega", "charizard-mega-x", "charizard-mega-y"
  if (rest.includes("mega")) {
    const suffix = rest.filter((p) => p !== "mega").map((p) => p.toUpperCase());
    return suffix.length ? `Mega ${base} ${suffix.join(" ")}` : `Mega ${base}`;
  }

  // Gigantamax: "charizard-gmax", "urshifu-rapid-strike-gmax"
  if (rest[rest.length - 1] === "gmax") {
    const formParts = rest.slice(0, -1);
    return formParts.length
      ? `${base} (${formParts.map(capitalize).join(" ")} Gigantamax)`
      : `${base} (Gigantamax)`;
  }

  // Regional forms: "raichu-alola", "meowth-galar", "darmanitan-galar-zen"
  const regionMap: Record<string, string> = {
    alola: "Alolan",
    galar: "Galarian",
    hisui: "Hisuian",
    paldea: "Paldean",
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

  // Generic alternate form: "rotom-heat" → "Rotom (Heat)", "giratina-origin" → "Giratina (Origin)"
  return `${base} (${rest.map(capitalize).join(" ")})`;
}

async function buildCache(): Promise<NormalizedPokemon[]> {
  // 1. Fetch full Pokemon list
  const listRes = await fetch(`${POKEAPI_BASE}/pokemon?limit=${POKEMON_LIMIT}`, {
    next: { revalidate: 86400 }, // 24h cache hint for edge/Next cache
  });
  if (!listRes.ok) throw new Error(`PokeAPI list failed: ${listRes.status}`);
  const listData = await listRes.json();

  const rawList: Array<{ name: string; url: string }> = listData.results ?? [];

  // 2. Build ID → types map using type list endpoints (18 parallel calls)
  const typeIndex = new Map<number, string[]>();

  const typeResults = await Promise.allSettled(
    TYPE_NAMES.map((t) =>
      fetch(`${POKEAPI_BASE}/type/${t}`, { next: { revalidate: 86400 } }).then((r) => r.json())
    )
  );

  for (let i = 0; i < TYPE_NAMES.length; i++) {
    const result = typeResults[i];
    if (result.status !== "fulfilled") continue;
    const typeName = TYPE_NAMES[i];
    const pokemonEntries: Array<{ pokemon: { name: string; url: string } }> =
      result.value?.pokemon ?? [];
    for (const entry of pokemonEntries) {
      const urlParts = entry.pokemon.url.replace(/\/$/, "").split("/");
      const pokemonId = parseInt(urlParts[urlParts.length - 1], 10);
      if (!Number.isFinite(pokemonId)) continue;
      if (!typeIndex.has(pokemonId)) typeIndex.set(pokemonId, []);
      typeIndex.get(pokemonId)!.push(typeName);
    }
  }

  // 3. Build normalized list
  const pokemon: NormalizedPokemon[] = rawList.map((entry) => {
    const urlParts = entry.url.replace(/\/$/, "").split("/");
    const id = parseInt(urlParts[urlParts.length - 1], 10);
    const types = typeIndex.get(id) ?? [];
    const typesStr = types.map(capitalize).join(" / ");

    return {
      id,
      name: {
        full: formatPokemonName(entry.name),
        native: typesStr || "Unknown",
      },
      gender: getGeneration(id),
      image: { large: getImageUrl(id) },
      favourites: getPopularityScore(id),
    };
  });

  // Sort: base Pokemon by ID first, then forms
  pokemon.sort((a, b) => {
    const aIsBase = a.id <= 1025;
    const bIsBase = b.id <= 1025;
    if (aIsBase && !bIsBase) return -1;
    if (!aIsBase && bIsBase) return 1;
    return a.id - b.id;
  });

  return pokemon;
}

export async function GET() {
  try {
    if (pokemonCache) {
      return Response.json({ pokemon: pokemonCache, total: pokemonCache.length });
    }

    if (!cacheBuilding) {
      cacheBuilding = buildCache().then((result) => {
        pokemonCache = result;
        return result;
      }).catch((err) => {
        cacheBuilding = null; // allow retry on failure
        throw err;
      });
    }

    const pokemon = await cacheBuilding;
    return Response.json({ pokemon, total: pokemon.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PokeAPI fetch failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
