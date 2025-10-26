"use client";
import React, { useEffect, useMemo, useState } from "react";

// ---------- types ----------

type Character = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

type PlayerColorKey =
  | "rose"
  | "sky"
  | "emerald"
  | "amber"
  | "fuchsia"
  | "indigo"
  | "lime"
  | "cyan";

type Player = {
  id: string;
  name: string;
  color: PlayerColorKey;
  slots: Record<string, Character | null>;
  popularityTotal: number;
};

// ---------- constants ----------

// slot names (your edited version)
const SLOT_NAMES = [
  "Waifu",
  "Husbando",
  "Not Human",
  "Not Alive or Artifical",
  "Old",
  "Minor Character",
  "Evil",
  "Child",
  "Comic Relief",
  "Wildcard",
];

const PLAYER_COLOR_KEYS: PlayerColorKey[] = [
  "rose",
  "sky",
  "emerald",
  "amber",
  "fuchsia",
  "indigo",
  "lime",
  "cyan",
];

const PLAYER_NAMES = [
  "Kai",
  "Som",
  "Dannie",
  "Nick",
  "Gizmo",
  "Ed",
  "Snowman",
  "King",
  "Mike",
];

const COLOR_MAP: Record<
  PlayerColorKey,
  { glow: string; text: string; border: string }
> = {
  rose: {
    glow: "shadow-[0_0_10px_rgba(244,63,94,0.5)]",
    text: "text-rose-400",
    border: "border-rose-500",
  },
  sky: {
    glow: "shadow-[0_0_10px_rgba(14,165,233,0.5)]",
    text: "text-sky-400",
    border: "border-sky-500",
  },
  emerald: {
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    text: "text-emerald-400",
    border: "border-emerald-500",
  },
  amber: {
    glow: "shadow-[0_0_10px_rgba(251,191,36,0.5)]",
    text: "text-amber-400",
    border: "border-amber-500",
  },
  fuchsia: {
    glow: "shadow-[0_0_10px_rgba(217,70,239,0.5)]",
    text: "text-fuchsia-400",
    border: "border-fuchsia-500",
  },
  indigo: {
    glow: "shadow-[0_0_10px_rgba(99,102,241,0.5)]",
    text: "text-indigo-400",
    border: "border-indigo-500",
  },
  lime: {
    glow: "shadow-[0_0_10px_rgba(163,230,53,0.5)]",
    text: "text-lime-400",
    border: "border-lime-500",
  },
  cyan: {
    glow: "shadow-[0_0_10px_rgba(34,211,238,0.5)]",
    text: "text-cyan-400",
    border: "border-cyan-500",
  },
};

// ---------- helpers ----------

function makeInitialPlayers(): Player[] {
  const shuffled = [...PLAYER_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    color: PLAYER_COLOR_KEYS[i % PLAYER_COLOR_KEYS.length],
    slots: Object.fromEntries(SLOT_NAMES.map((s) => [s, null])) as Record<
      string,
      Character | null
    >,
    popularityTotal: 0,
  }));
}

function firstEmptySlot(p: Player): string | null {
  for (const [slotName, val] of Object.entries(p.slots)) {
    if (!val) return slotName;
  }
  return null;
}

// ---------- component ----------

export default function CharacterDraftApp() {
  // data / draft state
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [players, setPlayers] = useState<Player[]>(makeInitialPlayers);

  const [round, setRound] = useState<number>(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);

  const [timerSeconds, setTimerSeconds] = useState<number>(180);
  const [paused, setPaused] = useState<boolean>(false);

  const [pendingPick, setPendingPick] = useState<Character | null>(null);
  const [showSlotModal, setShowSlotModal] = useState<boolean>(false);

  const [filters, setFilters] = useState<{ searchText: string; gender: string }>(
    { searchText: "", gender: "All" }
  );

  const [history, setHistory] = useState<
    { playerIndex: number; char: Character; slot: string }[]
  >([]);

  const [lastPick, setLastPick] = useState<{
    playerName: string;
    char: Character;
    slot: string;
  } | null>(null);

  // deep cut search state
  const [showDeepSearchModal, setShowDeepSearchModal] = useState<boolean>(false);
  const [deepSearchQuery, setDeepSearchQuery] = useState<string>("");
  const [deepSearchLoading, setDeepSearchLoading] = useState<boolean>(false);
  const [deepSearchResults, setDeepSearchResults] = useState<Character[]>([]);

  const currentPlayer = players[currentPlayerIndex];

  const clockDisplay = `${String(Math.floor(timerSeconds / 60)).padStart(
    2,
    "0"
  )}:${String(timerSeconds % 60).padStart(2, "0")}`;

  // ---------- fetch MANY pages of characters ----------
  useEffect(() => {
    async function loadAllPages() {
      try {
        setLoading(true);

        const bigList: Character[] = [];
        // page 1 .. 200 (20k-ish characters)
        for (let page = 1; page <= 200; page++) {
          const res = await fetch(`/api/characters?page=${page}`, {
            cache: "no-store",
          });

          if (!res.ok) {
            // stop if this page failed (rate limit or whatever)
            break;
          }

          const data = await res.json();

          const chunk: Character[] = data?.characters || [];
          if (!chunk.length) {
            // no more results
            break;
          }

          bigList.push(...chunk);
        }

        // de-dupe in case AniList returns overlaps between pages
        const byId = new Map<number, Character>();
        for (const ch of bigList) {
          if (!byId.has(ch.id)) {
            byId.set(ch.id, ch);
          }
        }

        // final array sorted by favourites desc
        const finalList = Array.from(byId.values()).sort(
          (a, b) => b.favourites - a.favourites
        );

        setCharacters(finalList);
      } catch (err) {
        console.error("Failed to load character pages:", err);
        setCharacters([]);
      } finally {
        setLoading(false);
      }
    }

    loadAllPages();
  }, []);

  // ---------- countdown timer (pauses in modal) ----------
  useEffect(() => {
    if (paused) return;

    const id = setInterval(() => {
      setTimerSeconds((t) => {
        if (t > 1) return t - 1;

        // timer hit zero -> autopick best available in first open slot
        autopick();
        return 180;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [paused, characters, players, currentPlayerIndex, round]);

  // ---------- filtering ----------
  const filtered = useMemo(() => {
    return characters.filter((c) => {
      const genderOK =
        filters.gender === "All" ||
        (c.gender &&
          c.gender.toLowerCase().includes(filters.gender.toLowerCase()));
      const textOK = `${c.name.full} ${c.name.native}`
        .toLowerCase()
        .includes(filters.searchText.toLowerCase());
      return genderOK && textOK;
    });
  }, [characters, filters]);

  // ---------- autopick when timer expires ----------
  function autopick() {
    if (!characters.length) return;
    const best = [...characters].sort(
      (a, b) => b.favourites - a.favourites
    )[0];
    const slot = firstEmptySlot(currentPlayer);
    if (!slot) return;
    performPick(best, slot);
  }

  // ---------- user clicked "Pick" ----------
  // enhance to accept either ID (normal board) or a full deep-search character
  function handleDraft(idOrChar: number | Character) {
    let chosen: Character | undefined;

    if (typeof idOrChar === "number") {
      chosen = characters.find((c) => c.id === idOrChar);
    } else {
      chosen = idOrChar;
    }

    if (!chosen) return;
    setPendingPick(chosen);
    setPaused(true);
    setShowSlotModal(true);
  }

  // ---------- lock character into a slot ----------
  function performPick(chosen: Character, slotName: string) {
    const idx = currentPlayerIndex;
    const drafter = players[idx];
    if (!slotName || drafter.slots[slotName]) return;

    // remove from pool (if they were in pool; if they came from deep search
    // and aren't in pool, this filter just won't remove anything, which is fine)
    setCharacters((prev) => prev.filter((c) => c.id !== chosen.id));

    // assign into that player's slot
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              slots: {
                ...p.slots,
                [slotName]: chosen,
              },
              popularityTotal: p.popularityTotal + (chosen.favourites || 0),
            }
          : p
      )
    );

    setLastPick({
      playerName: drafter.name,
      char: chosen,
      slot: slotName,
    });

    setHistory((h) => [
      ...h,
      { playerIndex: idx, char: chosen, slot: slotName },
    ]);

    // cleanup & move turn
    setShowSlotModal(false);
    setPendingPick(null);
    setPaused(false);
    advanceTurn();
  }

  // ---------- snake draft advancement logic ----------
  function advanceTurn() {
    setTimerSeconds(180);

    const odd = round % 2 === 1; // odd rounds go forward, even rounds go backward

    setCurrentPlayerIndex((i) => {
      const atEndFwd = odd && i === players.length - 1;
      const atEndBwd = !odd && i === 0;

      if (atEndFwd || atEndBwd) {
        // new round
        setRound((r) => r + 1);
        return odd ? players.length - 1 : 0;
      }

      return odd ? i + 1 : i - 1;
    });
  }

  // ---------- undo last pick ----------
  function handleUndo() {
    if (!history.length) return;
    const last = history[history.length - 1];
    const { playerIndex, char, slot } = last;

    // put character back into pool
    setCharacters((prev) => [...prev, char]);

    // free their slot + adjust score
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              slots: {
                ...p.slots,
                [slot]: null,
              },
              popularityTotal: Math.max(
                0,
                p.popularityTotal - (char.favourites || 0)
              ),
            }
          : p
      )
    );

    setHistory((h) => h.slice(0, -1));
    setCurrentPlayerIndex(playerIndex);
    // we aren't rewinding round, just give turn back
    setLastPick(null);
    setTimerSeconds(180);
  }

  // ---------- Deep Cut Search helper ----------
  async function runDeepSearch() {
    if (!deepSearchQuery.trim()) return;
    try {
      setDeepSearchLoading(true);

      const res = await fetch(
        `/api/searchCharacterByName?q=${encodeURIComponent(
          deepSearchQuery.trim()
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      if (Array.isArray(data.characters)) {
        setDeepSearchResults(data.characters);
      } else {
        setDeepSearchResults([]);
      }
    } catch (err) {
      console.error("deep search failed:", err);
      setDeepSearchResults([]);
    } finally {
      setDeepSearchLoading(false);
    }
  }

  // ---------- loading screen while we grab ~20k chars ----------
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-900 text-neutral-400 text-lg">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-neutral-200 animate-spin" />
        <div>Fetching gigantic character pool…</div>
        <div className="text-xs text-neutral-600">
          (This is normal — we’re pulling thousands)
        </div>
      </div>
    );
  }

  // ---------- UI ----------

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
      {/* HEADER */}
      <header className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Anime Character Draft</h1>

          <div className="text-sm text-neutral-400">
            On the clock:{" "}
            <span className="text-white font-semibold">
              {players[currentPlayerIndex].name}
            </span>{" "}
            (R{round}) —{" "}
            <span className="font-mono text-white">{clockDisplay}</span>
          </div>

          {lastPick && (
            <div className="text-xs text-neutral-500">
              Last pick:{" "}
              <span className="text-white">{lastPick.playerName}</span>{" "}
              drafted {lastPick.char.name.full} as {lastPick.slot}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm"
          >
            Undo
          </button>

          <button
            onClick={() => {
              const data = { players, round };
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "character-draft.json";
              a.click();
            }}
            className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm"
          >
            Export
          </button>
        </div>
      </header>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col">
          <label className="text-xs text-neutral-400">Gender</label>
          <select
            value={filters.gender}
            onChange={(e) =>
              setFilters((f) => ({ ...f, gender: e.target.value }))
            }
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
          >
            <option>All</option>
            <option>Male</option>
            <option>Female</option>
            <option>Non-binary</option>
            <option>Unknown</option>
          </select>
        </div>

        <div className="flex flex-col flex-1 min-w-[200px]">
          <label className="text-xs text-neutral-400">Search</label>
          <input
            value={filters.searchText}
            onChange={(e) =>
              setFilters((f) => ({ ...f, searchText: e.target.value }))
            }
            placeholder="Character name"
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* BODY */}
      <main className="grid xl:grid-cols-[1fr_1fr] gap-4">
        {/* LEFT: PLAYERS */}
        <aside className="space-y-4 overflow-y-auto max-h-[80vh] pr-1">
          {players.map((p, i) => {
            const col = COLOR_MAP[p.color];
            const isOnClock = i === currentPlayerIndex;

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 bg-neutral-900 ${
                  isOnClock ? col.border : "border-neutral-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-neutral-500">
                    {p.popularityTotal.toLocaleString()} ❤
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(p.slots).map(([slotName, charValue]) => {
                    const char = charValue as Character | null;
                    return (
                      <div
                        key={slotName}
                        className={`relative w-[90px] h-[120px] rounded border overflow-hidden ${col.glow}`}
                      >
                        {char ? (
                          <>
                            <img
                              src={char.image.large}
                              alt={char.name.full}
                              className="w-full h-full object-cover"
                            />
                            <div
                              className={`absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] font-semibold text-center py-[3px] ${col.text}`}
                            >
                              {slotName}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-[11px] font-semibold text-neutral-600 text-center leading-tight px-1">
                            {slotName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>

        {/* RIGHT: CHARACTER POOL */}
        <section className="overflow-y-auto max-h-[80vh] grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* header row with deep cut button */}
          <div className="md:col-span-2 flex items-start justify-between bg-neutral-800 border border-neutral-700 rounded-xl p-3">
            <div className="text-xs text-neutral-400 leading-tight">
              {filtered.length} results
              <br />
              <span className="text-neutral-500">
                Can't find someone? Try deep cut search.
              </span>
            </div>

            <button
              onClick={() => {
                setShowDeepSearchModal(true);
                setDeepSearchQuery("");
                setDeepSearchResults([]);
              }}
              className="text-[11px] font-semibold bg-gradient-to-r from-indigo-600/30 to-fuchsia-600/30 border border-fuchsia-500/40 text-fuchsia-300 rounded px-2 py-1 hover:from-indigo-600/40 hover:to-fuchsia-600/40 hover:text-white shadow-[0_0_10px_rgba(217,70,239,0.6)]"
            >
              Deep Cut Search
            </button>
          </div>

          {filtered.map((c, idx) => (
            <div
              key={c.id}
              className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex gap-3"
            >
              <img
                src={c.image.large}
                alt={c.name.full}
                className="w-20 h-28 object-cover rounded"
              />
              <div className="flex-1">
                <div className="font-semibold text-neutral-100">
                  {c.name.full}
                </div>
                <div className="text-xs text-neutral-400">
                  {c.name.native}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {c.gender} • ❤ {c.favourites.toLocaleString()}
                </div>

                <button
                  onClick={() => handleDraft(c.id)}
                  className="mt-2 text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1 hover:bg-neutral-700"
                >
                  Pick #{idx + 1}
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* SLOT SELECTION MODAL */}
      {showSlotModal && pendingPick && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[400px] max-w-[90vw]">
            <h2 className="text-lg font-bold mb-2 text-white">
              Assign Slot
            </h2>
            <p className="text-sm text-neutral-400 mb-3">
              Select a slot for{" "}
              <span className="text-white font-semibold">
                {pendingPick.name.full}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(currentPlayer.slots)
                .filter(([_, v]) => !v)
                .map(([slotName]) => (
                  <button
                    key={slotName}
                    onClick={() => performPick(pendingPick, slotName)}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm hover:bg-neutral-700 text-white"
                  >
                    {slotName}
                  </button>
                ))}
            </div>

            <button
              onClick={() => {
                setShowSlotModal(false);
                setPaused(false);
                setPendingPick(null);
              }}
              className="mt-4 text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DEEP CUT SEARCH MODAL */}
      {showDeepSearchModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-bold mb-2 text-white">
              Deep Cut Character Search
            </h2>
            <p className="text-sm text-neutral-400 mb-3 leading-snug">
              Type part of their name. We'll query AniList directly, even if
              they're super obscure (low favourites).
            </p>

            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm text-white"
                placeholder="e.g. Rakushun"
                value={deepSearchQuery}
                onChange={(e) => setDeepSearchQuery(e.target.value)}
              />
              <button
                onClick={runDeepSearch}
                className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700 text-white"
              >
                Search
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-neutral-800 rounded p-2 bg-neutral-950/50">
              {deepSearchLoading && (
                <div className="text-neutral-500 text-sm italic">
                  Searching…
                </div>
              )}

              {!deepSearchLoading && deepSearchResults.length === 0 && (
                <div className="text-neutral-600 text-sm italic">
                  No results yet.
                </div>
              )}

              {!deepSearchLoading && deepSearchResults.length > 0 && (
                <div className="grid gap-2">
                  {deepSearchResults.map((c, idx) => (
                    <div
                      key={c.id}
                      className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex gap-3"
                    >
                      <img
                        src={c.image.large}
                        alt={c.name.full}
                        className="w-16 h-20 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-100 truncate">
                          {c.name.full}
                        </div>
                        <div className="text-xs text-neutral-400 truncate">
                          {c.name.native}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {c.gender} • ❤ {c.favourites.toLocaleString()}
                        </div>

                        <button
                          onClick={() => {
                            // choose this deep cut character, go straight to slot modal
                            handleDraft(c);
                            // close this modal (slot modal will now open)
                            setShowDeepSearchModal(false);
                          }}
                          className="mt-2 text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1 hover:bg-neutral-700"
                        >
                          Pick #{idx + 1}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowDeepSearchModal(false);
                setDeepSearchResults([]);
                setDeepSearchQuery("");
              }}
              className="mt-4 text-xs text-neutral-500 hover:text-neutral-300 self-start"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
