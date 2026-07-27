import React from "react";
import { Character } from "../../../api/lobby/logic";
import { DraftPoolStatus } from "../../../components/DraftPoolStatus";
import { ScoutCoveragePanel } from "../../../components/ScoutCoveragePanel";
import { ScoutQueueNotice } from "../../../components/ScoutQueueNotice";
import type { DraftPickAvailability } from "../../../lib/draftPickAvailability";
import type {
    DraftScoutSlotPlans,
    DraftScoutCoverage,
    DraftShortlistMove,
} from "../../../lib/draftShortlist";

type Props = {
    characters: Character[];
    filteredPool: Character[];
    filters: { searchText: string; gender: string };
    setFilters: React.Dispatch<
        React.SetStateAction<{ searchText: string; gender: string }>
    >;
    onPick: (charId: number) => void;
    onDeepSearch: () => void;
    onRandom: () => void;
    shortlistedIds: ReadonlySet<number>;
    shortlistOrder: readonly number[];
    scoutSlotPlans: DraftScoutSlotPlans;
    scoutCoverage: DraftScoutCoverage;
    availableSlotNames: readonly string[];
    pickAvailability: DraftPickAvailability;
    scoutNoticeNames: string[] | null;
    showShortlistOnly: boolean;
    onToggleShortlist: (charId: number) => void;
    onMoveShortlist: (charId: number, direction: DraftShortlistMove) => void;
    onSetScoutSlotPlan: (charId: number, slotName: string) => void;
    onDismissScoutNotice: () => void;
    onToggleShortlistOnly: () => void;
};

export function CharacterPool({
    characters,
    filteredPool,
    filters,
    setFilters,
    onPick,
    onDeepSearch,
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
    onSetScoutSlotPlan,
    onDismissScoutNotice,
    onToggleShortlistOnly,
}: Props) {
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
                draftType="anime"
            />
            {showShortlistOnly && (
                <ScoutCoveragePanel coverage={scoutCoverage} />
            )}
            <div
                className="mb-3 rounded-xl border border-neutral-700 bg-neutral-900/90 p-3 shadow-[0_10px_20px_rgba(0,0,0,0.6)] backdrop-blur-sm lg:sticky lg:top-0 lg:z-20"
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
                    <div className="flex flex-col">
                        <label className="text-[10px] uppercase text-neutral-500 font-semibold">
                            Can&apos;t Find Them?
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={onRandom}
                                className="text-[11px] font-semibold bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 text-emerald-300 rounded px-2 py-1 hover:from-emerald-600/40 hover:to-teal-600/40 hover:text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                                title="Pick a random character from the current view"
                            >
                                Random 1
                            </button>
                            <button
                                onClick={onDeepSearch}
                                className="text-[11px] font-semibold bg-gradient-to-r from-indigo-600/30 to-fuchsia-600/30 border border-fuchsia-500/40 text-fuchsia-300 rounded px-2 py-1 hover:from-indigo-600/40 hover:to-fuchsia-600/40 hover:text-white shadow-[0_0_10px_rgba(217,70,239,0.6)]"
                            >
                                Deep Cut Search
                            </button>
                        </div>
                    </div>
                    <div className="text-[10px] text-neutral-500 leading-tight">
                        {filteredPool.length} matches in local pool
                        <br />
                        total loaded: {characters.length}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 pr-1 md:grid-cols-2 lg:max-h-[70vh] lg:overflow-y-auto">
                {filteredPool.map((c, idx) => {
                    const isShortlisted = shortlistedIds.has(c.id);
                    const priorityIndex = shortlistOrder.indexOf(c.id);
                    const plannedSlotName = scoutSlotPlans[c.id] ?? "";
                    const plannedSlotIsFilled =
                        Boolean(plannedSlotName) &&
                        !availableSlotNames.includes(plannedSlotName);
                    return (
                        <div
                            key={c.id}
                            className={`bg-neutral-900 border rounded-xl p-3 flex gap-3 ${
                                isShortlisted ? "border-amber-500/60" : "border-neutral-700"
                            }`}
                        >
                            <img
                                src={c.image.large}
                                alt={c.name.full}
                                className="w-20 h-28 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="font-semibold text-neutral-100 truncate">
                                        {c.name.full}
                                    </div>
                                    <button
                                        type="button"
                                        aria-pressed={isShortlisted}
                                        aria-label={`${isShortlisted ? "Remove" : "Add"} ${c.name.full} ${isShortlisted ? "from" : "to"} your Scout List`}
                                        onClick={() => onToggleShortlist(c.id)}
                                        className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold ${
                                            isShortlisted
                                                ? "border-amber-400 bg-amber-500/15 text-amber-200"
                                                : "border-neutral-700 text-neutral-400 hover:border-amber-500/60 hover:text-amber-200"
                                        }`}
                                    >
                                        {isShortlisted ? "★ Saved" : "☆ Save"}
                                    </button>
                                </div>
                                <div className="text-xs text-neutral-400 truncate">
                                    {c.name.native}
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">
                                    {c.gender} {"\u2022"} {"\u2764"}{" "}
                                    {c.favourites.toLocaleString()}
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
                                                    aria-label={`Change ${c.name.full} priority`}
                                                >
                                                    <button
                                                        type="button"
                                                        disabled={priorityIndex === 0}
                                                        aria-label={`Move ${c.name.full} up in your pick queue`}
                                                        onClick={() => onMoveShortlist(c.id, "up")}
                                                        className="rounded border border-amber-500/30 px-2 py-0.5 text-xs text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                                                    >
                                                        <span aria-hidden="true">↑</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={priorityIndex === shortlistOrder.length - 1}
                                                        aria-label={`Move ${c.name.full} down in your pick queue`}
                                                        onClick={() => onMoveShortlist(c.id, "down")}
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
                                                    htmlFor={`anime-scout-slot-${c.id}`}
                                                    className="mb-1 block text-[9px] font-semibold uppercase tracking-wide text-neutral-500"
                                                >
                                                    Planned slot · private
                                                </label>
                                                <select
                                                    id={`anime-scout-slot-${c.id}`}
                                                    value={plannedSlotName}
                                                    onChange={(event) =>
                                                        onSetScoutSlotPlan(c.id, event.target.value)
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
                                            ? `Draft ${c.name.full}`
                                            : pickAvailability.label
                                    }
                                    onClick={() => onPick(c.id)}
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
                {filteredPool.length === 0 && (
                    <div className="col-span-full text-center text-neutral-500 text-sm py-12">
                        {showShortlistOnly
                            ? "No queued candidates match these filters."
                            : "No local matches."}
                        <div className="mt-2 text-[11px] text-neutral-600">
                            {showShortlistOnly
                                ? "Adjust your filters or add candidates with ☆ Save."
                                : <>Try Deep Cut Search {"\u2192"} to pull from AniList directly.</>}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
