import React from "react";
import { Character } from "../../../api/lobby/logic";

type Props = {
    characters: Character[];
    filteredPool: Character[];
    filters: { searchText: string; gender: string };
    setFilters: React.Dispatch<
        React.SetStateAction<{ searchText: string; gender: string }>
    >;
    onPick: (charId: number) => void;
    onDeepSearch: () => void;
};

export function CharacterPool({
    characters,
    filteredPool,
    filters,
    setFilters,
    onPick,
    onDeepSearch,
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
                <div className="flex flex-wrap gap-4 items-start justify-between">
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase text-neutral-500 font-semibold">
                            Gender
                        </label>
                        <select
                            value={filters.gender}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, gender: e.target.value }))
                            }
                            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                        >
                            <option>All</option>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Non-binary</option>
                            <option>Unknown</option>
                        </select>
                    </div>
                    <div className="flex flex-col min-w-[180px] flex-1 max-w-[220px]">
                        <label className="text-[10px] uppercase text-neutral-500 font-semibold">
                            Search
                        </label>
                        <input
                            value={filters.searchText}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, searchText: e.target.value }))
                            }
                            placeholder="Character name"
                            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white w-full"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase text-neutral-500 font-semibold">
                            Can&apos;t Find Them?
                        </label>
                        <button
                            onClick={onDeepSearch}
                            className="text-[11px] font-semibold bg-gradient-to-r from-indigo-600/30 to-fuchsia-600/30 border border-fuchsia-500/40 text-fuchsia-300 rounded px-2 py-1 hover:from-indigo-600/40 hover:to-fuchsia-600/40 hover:text-white shadow-[0_0_10px_rgba(217,70,239,0.6)]"
                        >
                            Deep Cut Search
                        </button>
                    </div>
                    <div className="text-[10px] text-neutral-500 leading-tight">
                        {filteredPool.length} matches in local pool
                        <br />
                        total loaded: {characters.length}
                    </div>
                </div>
            </div>
            <div className="overflow-y-auto max-h-[70vh] pr-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPool.map((c, idx) => (
                    <div
                        key={c.id}
                        className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex gap-3"
                    >
                        <img
                            src={c.image.large}
                            alt={c.name.full}
                            className="w-20 h-28 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="font-semibold text-neutral-100 truncate">
                                {c.name.full}
                            </div>
                            <div className="text-xs text-neutral-400 truncate">
                                {c.name.native}
                            </div>
                            <div className="text-xs text-neutral-500 mt-1">
                                {c.gender} {"\u2022"} {"\u2764"}{" "}
                                {c.favourites.toLocaleString()}
                            </div>
                            <button
                                onClick={() => onPick(c.id)}
                                className="mt-2 text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1 hover:bg-neutral-700"
                            >
                                Pick #{idx + 1}
                            </button>
                        </div>
                    </div>
                ))}
                {filteredPool.length === 0 && (
                    <div className="col-span-full text-center text-neutral-500 text-sm py-12">
                        No local matches.
                        <div className="mt-2 text-[11px] text-neutral-600">
                            Try Deep Cut Search {"\u2192"} to pull from AniList directly.
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
