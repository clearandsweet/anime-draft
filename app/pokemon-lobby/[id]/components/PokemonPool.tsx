import React, { useMemo, useState } from "react";
import { Character } from "../../../api/lobby/logic";
import { DraftPoolStatus } from "../../../components/DraftPoolStatus";
import { ScoutCoveragePanel } from "../../../components/ScoutCoveragePanel";
import { ScoutQueueNotice } from "../../../components/ScoutQueueNotice";
import type { DraftPickAvailability } from "../../../lib/draftPickAvailability";
import { filterDraftScoutCandidateIds } from "../../../lib/draftShortlist";
import type {
  DraftScoutSlotPlans,
  DraftScoutCoverage,
  DraftShortlistMove,
} from "../../../lib/draftShortlist";

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
  shortlistedIds: ReadonlySet<number>;
  shortlistOrder: readonly number[];
  scoutSlotPlans: DraftScoutSlotPlans;
  scoutCoverage: DraftScoutCoverage;
  availableSlotNames: readonly string[];
  pickAvailability: DraftPickAvailability;
  scoutNoticeNames: string[] | null;
  showShortlistOnly: boolean;
  onToggleShortlist: (pokemonId: number) => void;
  onMoveShortlist: (pokemonId: number, direction: DraftShortlistMove) => void;
  onPrioritizeShortlist: (pokemonId: number) => void;
  onSetScoutSlotPlan: (pokemonId: number, slotName: string) => void;
  onDismissScoutNotice: () => void;
  onToggleShortlistOnly: () => void;
};

export function PokemonPool({
  pokemon,
  filteredPool,
  filters,
  setFilters,
  onPick,
  onSearch,
  onRandom,
  shortlistedIds,
  shortlistOrder,
  scoutSlotPlans,
  scoutCoverage,
  availableSlotNames,
  pickAvailability,
  scoutNoticeNames,
  showShortlistOnly,
  onToggleShortlist,
  onMoveShortlist,
  onPrioritizeShortlist,
  onSetScoutSlotPlan,
  onDismissScoutNotice,
  onToggleShortlistOnly,
}: Props) {
  const [focusedScoutSlotName, setFocusedScoutSlotName] = useState("");
  const activeFocusedScoutSlotName =
    showShortlistOnly && availableSlotNames.includes(focusedScoutSlotName)
      ? focusedScoutSlotName
      : "";
  const visiblePool = useMemo(() => {
    if (!activeFocusedScoutSlotName) return filteredPool;
    const focusedIds = new Set(
      filterDraftScoutCandidateIds(
        filteredPool.map((candidate) => candidate.id),
        scoutSlotPlans,
        activeFocusedScoutSlotName
      )
    );
    return filteredPool.filter((candidate) => focusedIds.has(candidate.id));
  }, [
    activeFocusedScoutSlotName,
    filteredPool,
    scoutSlotPlans,
  ]);

  return (
    <section className="flex flex-col bg-neutral-900/0">
      {scoutNoticeNames && scoutNoticeNames.length > 0 && (
        <ScoutQueueNotice
          candidateNames={scoutNoticeNames}
          onDismiss={onDismissScoutNotice}
        />
      )}
      <DraftPoolStatus
        availability={pickAvailability}
        draftType="pokemon"
      />
      {showShortlistOnly && (
        <ScoutCoveragePanel
          coverage={scoutCoverage}
          focusedSlotName={activeFocusedScoutSlotName}
          onFocusSlot={setFocusedScoutSlotName}
        />
      )}
      <div
        className="mb-3 rounded-xl border border-neutral-700 bg-neutral-900/90 p-3 shadow-[0_10px_20px_rgba(0,0,0,0.6)] backdrop-blur-sm lg:sticky lg:top-0 lg:z-20"
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

          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-neutral-500 font-semibold">
              Pick Queue
            </label>
            <button
              type="button"
              aria-pressed={showShortlistOnly}
              onClick={onToggleShortlistOnly}
              className={`rounded border px-2 py-1 text-[11px] font-semibold transition ${
                showShortlistOnly
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-amber-500/60 hover:text-amber-200"
              }`}
            >
              {showShortlistOnly
                ? `Showing queue (${shortlistedIds.size})`
                : `Scout queue (${shortlistedIds.size})`}
            </button>
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
            {visiblePool.length} shown
            <br />
            {pokemon.length} total loaded
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 pr-1 md:grid-cols-2 lg:max-h-[70vh] lg:overflow-y-auto">
        {visiblePool.map((p, idx) => {
          const isShortlisted = shortlistedIds.has(p.id);
          const priorityIndex = shortlistOrder.indexOf(p.id);
          const plannedSlotName = scoutSlotPlans[p.id] ?? "";
          const plannedSlotIsFilled =
            Boolean(plannedSlotName) &&
            !availableSlotNames.includes(plannedSlotName);
          return (
            <div
              key={p.id}
              className={`bg-neutral-900 border rounded-xl p-3 flex gap-3 ${
                isShortlisted ? "border-amber-500/60" : "border-neutral-700"
              }`}
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
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-neutral-100 truncate">
                  {p.name.full}
                </div>
                <button
                  type="button"
                  aria-pressed={isShortlisted}
                  aria-label={`${isShortlisted ? "Remove" : "Add"} ${p.name.full} ${isShortlisted ? "from" : "to"} your Scout List`}
                  onClick={() => onToggleShortlist(p.id)}
                  className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold ${
                    isShortlisted
                      ? "border-amber-400 bg-amber-500/15 text-amber-200"
                      : "border-neutral-700 text-neutral-400 hover:border-amber-500/60 hover:text-amber-200"
                  }`}
                >
                  {isShortlisted ? "★ Saved" : "☆ Save"}
                </button>
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {p.name.native}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {p.gender} · #{p.id}
              </div>
              {isShortlisted && priorityIndex >= 0 && (
                <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                      Priority {priorityIndex + 1}
                    </span>
                    {showShortlistOnly && (
                      <span
                        className="flex gap-1"
                        role="group"
                        aria-label={`Change ${p.name.full} priority`}
                      >
                        <button
                          type="button"
                          disabled={priorityIndex === 0}
                          aria-label={`Make ${p.name.full} your top pick`}
                          onClick={() => onPrioritizeShortlist(p.id)}
                          className="rounded border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Top
                        </button>
                        <button
                          type="button"
                          disabled={priorityIndex === 0}
                          aria-label={`Move ${p.name.full} up in your pick queue`}
                          onClick={() => onMoveShortlist(p.id, "up")}
                          className="rounded border border-amber-500/30 px-2 py-0.5 text-xs text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button
                          type="button"
                          disabled={priorityIndex === shortlistOrder.length - 1}
                          aria-label={`Move ${p.name.full} down in your pick queue`}
                          onClick={() => onMoveShortlist(p.id, "down")}
                          className="rounded border border-amber-500/30 px-2 py-0.5 text-xs text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <span aria-hidden="true">↓</span>
                        </button>
                      </span>
                    )}
                  </div>
                  {showShortlistOnly && (
                    <div className="mt-2">
                      <label
                        htmlFor={`pokemon-scout-slot-${p.id}`}
                        className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-neutral-500"
                      >
                        Planned category · private
                      </label>
                      <select
                        id={`pokemon-scout-slot-${p.id}`}
                        value={plannedSlotName}
                        onChange={(event) =>
                          onSetScoutSlotPlan(p.id, event.target.value)
                        }
                        disabled={
                          availableSlotNames.length === 0 &&
                          !plannedSlotName
                        }
                        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-[11px] text-neutral-200 disabled:opacity-50"
                      >
                        <option value="">
                          {availableSlotNames.length
                            ? "Choose a category…"
                            : "No open categories"}
                        </option>
                        {plannedSlotIsFilled && (
                          <option value={plannedSlotName} disabled>
                            {plannedSlotName} (filled)
                          </option>
                        )}
                        {availableSlotNames.map((slotName) => (
                          <option key={slotName} value={slotName}>
                            {slotName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                disabled={!pickAvailability.canPick}
                title={
                  pickAvailability.canPick
                    ? `Draft ${p.name.full}`
                    : pickAvailability.label
                }
                onClick={() => onPick(p.id)}
                className="mt-2 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-neutral-800"
              >
                {showShortlistOnly && priorityIndex >= 0
                  ? `Pick priority #${priorityIndex + 1}`
                  : `Pick #${idx + 1}`}
              </button>
            </div>
          </div>
          );
        })}
        {visiblePool.length === 0 && (
          <div className="col-span-full text-center text-neutral-500 text-sm py-12">
            {activeFocusedScoutSlotName
              ? `No visible Pokémon are planned for ${activeFocusedScoutSlotName}.`
              : showShortlistOnly
              ? "No queued Pokémon match these filters."
              : "No Pokémon match your filters."}
            <div className="mt-2 text-[11px] text-neutral-600">
              {activeFocusedScoutSlotName
                ? "Clear the other filters or show the full queue."
                : showShortlistOnly
                ? "Adjust your filters or add Pokémon with ☆ Save."
                : "Try Pokédex Search to look up by exact name or number."}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
