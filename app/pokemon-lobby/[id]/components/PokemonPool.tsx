import React from "react";
import { Character } from "../../../api/lobby/logic";

const GENERATIONS = [
  "All", "Gen 1", "Gen 2", "Gen 3", "Gen 4",
  "Gen 5", "Gen 6", "Gen 7", "Gen 8", "Gen 9", "Form",
];

const TYPES = [
  "All",
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice",
  "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
  "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
];

export type PokemonFilters = {
  searchText: string;
  type: string;
  generation: string;
};

type Props = {
  pokemon: Character[];
  filteredPool: Character[];
  filters: PokemonFilters;
  setFilters: React.Dispatch<React.SetStateAction<PokemonFilters>>;
  onPick: (pokemonId: number) => void;
  onSearch: () => void;
  onRandom: () => void;
};

export function PokemonPool({
  pokemon,
  filteredPool,
  filters,
  setFilters,
  onPick,
  onSearch,
  onRandom,
}: Props) {
  return (
    <section className="flex flex-col bg-neutral-900/0">
      <div
        className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-3 mb-3 shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backgroundColor: "rgba(23,23,23,0.9)",
          backdropFilter: "blur(4px)",
        }}
      >
        <div className="flex flex-wrap gap-3 items-start justify-between">
          {/* Search by name or number */}
          <div className="flex flex-col min-w-[160px] flex-1 max-w-[240px]">
            <label className="text-[10px] uppercase text-neutral-500 font-semibold">
              Name or # Search
            </label>
            <input
              value={filters.searchText}
              onChange={(e) => setFilters((f) => ({ ...f, searchText: e.target.value }))}
              placeholder="e.g. Pikachu or 25"
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white w-full"
            />
          </div>

          {/* Type filter */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-neutral-500 font-semibold">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Generation filter */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-neutral-500 font-semibold">Generation</label>
            <select
              value={filters.generation}
              onChange={(e) => setFilters((f) => ({ ...f, generation: e.target.value }))}
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
            >
              {GENERATIONS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-neutral-500 font-semibold">
              Can&apos;t Find Them?
            </label>
            <div className="flex gap-2">
              <button
                onClick={onRandom}
                className="text-[11px] font-semibold bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 text-emerald-300 rounded px-2 py-1 hover:from-emerald-600/40 hover:to-teal-600/40 hover:text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                title="Pick a random Pokémon from the current view"
              >
                Random
              </button>
              <button
                onClick={onSearch}
                className="text-[11px] font-semibold bg-gradient-to-r from-red-600/30 to-orange-600/30 border border-red-500/40 text-red-300 rounded px-2 py-1 hover:from-red-600/40 hover:to-orange-600/40 hover:text-white shadow-[0_0_10px_rgba(239,68,68,0.6)]"
              >
                Pokédex Search
              </button>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 leading-tight self-end">
            {filteredPool.length} shown
            <br />
            {pokemon.length} total loaded
          </div>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[70vh] pr-1 grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredPool.map((p, idx) => (
          <div
            key={p.id}
            className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex gap-3"
          >
            <img
              src={p.image.large}
              alt={p.name.full}
              className="w-20 h-20 object-contain rounded bg-neutral-950"
              onError={(e) => {
                // Fallback to front sprite if official artwork fails
                const img = e.currentTarget;
                if (!img.src.includes("/pokemon/other/")) return;
                img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-neutral-100 truncate">{p.name.full}</div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {p.name.native}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {p.gender} · #{p.id}
              </div>
              <button
                onClick={() => onPick(p.id)}
                className="mt-2 text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1 hover:bg-neutral-700"
              >
                Pick #{idx + 1}
              </button>
            </div>
          </div>
        ))}
        {filteredPool.length === 0 && (
          <div className="col-span-full text-center text-neutral-500 text-sm py-12">
            No Pokémon match your filters.
            <div className="mt-2 text-[11px] text-neutral-600">
              Try Pokédex Search to look up by exact name or number.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
