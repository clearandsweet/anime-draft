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

const SLOT_NAMES = [
  "Waifu",
  "Husbando",
  "Animal",
  "Artificial",
  "Old",
  "Protagonist",
  "Villain",
  "Mentor",
  "Comic Relief",
  "Wildcard",
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

export default function CharacterDraftApp() {
  // ---------- state ----------

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [players, setPlayers] = useState<Player[]>(makeInitialPlayers);

  const [round, setRound] = useState<number>(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);

  const [timerSeconds, setTimerSeconds] = useState<number>(180);
  const [paused, setPaused] = useState<boolean>(false);

  const [pendingPick, setPendingPick] = useState<Character | null>(null);
  const [showSlotModal, setShowSlotModal] = useState<boolean>(false);

  const [filters, setFilters] = useState<{ searchText: string; gender: string }>({
    searchText: "",
    gender: "All",
  });

  const [history, setHistory] = useState<
    { playerIndex: number; char: Character; slot: string }[]
  >([]);

  const [lastPick, setLastPick] = useState<{
    playerName: string;
    char: Character;
    slot: string;
  } | null>(null);

  const currentPlayer = players[currentPlayerIndex];

  const clockDisplay = `${String(Math.floor(timerSeconds / 60)).padStart(
    2,
    "0"
  )}:${String(timerSeconds % 60).padStart(2, "0")}`;

  // ---------- data fetch ----------

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/characters", { cache: "no-store" });
        const data = await res.json();
        if (data?.characters) {
          setCharacters(data.characters as Character[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ---------- timer with pause ----------

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setTimerSeconds((t) => {
        if (t > 1) return t - 1;

        // time ran out -> autopick
        autopick();
        return 180;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---------- autopick ----------

  function autopick() {
    if (!characters.length) return;
    const top = [...characters].sort(
      (a, b) => b.favourites - a.favourites
    )[0];
    const slot = firstEmptySlot(currentPlayer);
    if (!slot) return; // <-- important: can't assign if all slots full
    performPick(top, slot);
  }

  // ---------- draft flow ----------

  function handleDraft(id: number) {
    const chosen = characters.find((c) => c.id === id);
    if (!chosen) return;
    setPendingPick(chosen);
    setPaused(true);
    setShowSlotModal(true);
  }

  function performPick(chosen: Character, slotName: string) {
    const idx = currentPlayerIndex;
    const drafter = players[idx];
    if (!slotName || drafter.slots[slotName]) return;

    // remove character from pool
    setCharacters((prev) => prev.filter((c) => c.id !== chosen.id));

    // assign to slot + update popularity total
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

    // close modal, unpause, next turn
    setShowSlotModal(false);
    setPendingPick(null);
    setPaused(false);
    advanceTurn();
  }

  function advanceTurn() {
    setTimerSeconds(180);

    const odd = round % 2 === 1; // snake draft: odd rounds go forward
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

  function handleUndo() {
    if (!history.length) return;
    const last = history[history.length - 1];
    const { playerIndex, char, slot } = last;

    // put character back in pool
    setCharacters((prev) => [...prev, char]);

    // clear that slot + adjust total
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

    // rollback turn to that drafter
    setHistory((h) => h.slice(0, -1));
    setCurrentPlayerIndex(playerIndex);
    // round stays the same visually — we aren't rewinding round count here
    setLastPick(null);
    setTimerSeconds(180);
  }

  // ---------- loading state ----------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-400 text-lg">
        Fetching 10 000 characters…
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
              {currentPlayer.name}
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
                  {Object.entries(p.slots).map(
                    ([slotName, charValue]) => {
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
                                className={`absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-center py-[2px] ${col.text}`}
                              >
                                {slotName}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-[10px] text-neutral-600 italic">
                              {slotName}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            );
          })}
        </aside>

        {/* RIGHT: CHARACTER POOL */}
        <section className="overflow-y-auto max-h-[80vh] grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[400px]">
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
    </div>
  );
}
