"use client";

import React, { useEffect, useMemo, useState } from "react";

// ---------- Shared Types (mirror server) ----------

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
  id: string; // e.g. "p1"
  name: string;
  color: PlayerColorKey | string;
  slots: Record<string, Character | null>;
  popularityTotal: number;
};

type LobbyState = {
  players: Player[];
  round: number;
  currentPlayerIndex: number;
  timerSeconds: number;
  lastPick: null | {
    playerName: string;
    char: Character;
    slot: string;
  };
  history: { playerIndex: number; char: Character; slot: string }[];
};

// ---------- Constants (slots must match server!) ----------

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

// color map for glow/border in roster cards
const COLOR_MAP: Record<
  string,
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

  // just in case
  default: {
    glow: "shadow-[0_0_10px_rgba(255,255,255,0.15)]",
    text: "text-neutral-300",
    border: "border-neutral-500",
  },
};

// pick a color style safely
function colorStyleForPlayer(p: Player) {
  return COLOR_MAP[p.color] || COLOR_MAP["default"];
}

// ---------- Component ----------

export default function CharacterDraftApp() {
  //
  // --- Local-only state (per browser) ---
  //

  // this browser's claimed identity
  const [meName, setMeName] = useState<string>("");

  // giant character pool (local only)
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingChars, setLoadingChars] = useState<boolean>(true);

  // filters for right panel
  const [filters, setFilters] = useState<{ searchText: string; gender: string }>(
    { searchText: "", gender: "All" }
  );

  // deep cut search modal state
  const [showDeepSearchModal, setShowDeepSearchModal] = useState<boolean>(false);
  const [deepSearchQuery, setDeepSearchQuery] = useState<string>("");
  const [deepSearchLoading, setDeepSearchLoading] = useState<boolean>(false);
  const [deepSearchResults, setDeepSearchResults] = useState<Character[]>([]);

  // slot selection modal state
  const [showSlotModal, setShowSlotModal] = useState<boolean>(false);
  const [pendingPick, setPendingPick] = useState<Character | null>(null);

  //
  // --- Shared lobby state (fetched from server) ---
  //

  const [lobby, setLobby] = useState<LobbyState>({
    players: [],
    round: 1,
    currentPlayerIndex: 0,
    timerSeconds: 180,
    lastPick: null,
    history: [],
  });

  //
  // ---------- Load giant character pool (local only) ----------
  //
  useEffect(() => {
    async function loadAllPages() {
      try {
        setLoadingChars(true);

        const bigList: Character[] = [];

        // up to page 200 => ~20k chars
        for (let page = 1; page <= 200; page++) {
          const res = await fetch(`/api/characters?page=${page}`, {
            cache: "no-store",
          });

          if (!res.ok) break;

          const data = await res.json();
          const chunk: Character[] = data?.characters || [];
          if (!chunk.length) break;

          bigList.push(...chunk);
        }

        // de-dupe by ID
        const byId = new Map<number, Character>();
        for (const ch of bigList) {
          if (!byId.has(ch.id)) {
            byId.set(ch.id, ch);
          }
        }

        // sort by favourites desc
        const finalList = Array.from(byId.values()).sort(
          (a, b) => b.favourites - a.favourites
        );

        setCharacters(finalList);
      } catch (err) {
        console.error("Failed to load character pages:", err);
        setCharacters([]);
      } finally {
        setLoadingChars(false);
      }
    }

    loadAllPages();
  }, []);

  //
  // ---------- Poll lobby state from server every second ----------
  //
  // NOTE: server also ticks the shared timer when we GET /api/lobby/state
  //
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/lobby/state", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: LobbyState = await res.json();
        setLobby(data);
      } catch (err) {
        console.error("poll lobby/state failed", err);
      }
    }, 1000);

    return () => clearInterval(id);
  }, []);

  //
  // ---------- Auto-join lobby when meName is set ----------
  //
  useEffect(() => {
    async function joinLobby() {
      if (!meName.trim()) return;
      try {
        await fetch("/api/lobby/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: meName.trim() }),
        });
        // we don't have to manually setLobby here; the poll loop will pick up new players
      } catch (err) {
        console.error("join lobby failed", err);
      }
    }

    joinLobby();
  }, [meName]);

  //
  // ---------- Derived values ----------
  //
  const currentPlayer =
    lobby.players[lobby.currentPlayerIndex] || null;

  const clockDisplay = `${String(
    Math.floor(lobby.timerSeconds / 60)
  ).padStart(2, "0")}:${String(
    lobby.timerSeconds % 60
  ).padStart(2, "0")}`;

  // filter the local pool based on gender + search text
  const filteredLocalPool = useMemo(() => {
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

  //
  // ---------- Deep Cut Search helper ----------
  //
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

  //
  // ---------- Choosing a character to draft (client-side step 1) ----------
  //
  // When you click "Pick" from either the main pool or deep search:
  // - we store that character in pendingPick
  // - open the slot selection modal
  // - we DO NOT talk to the server yet
  //
  function beginDraftPick(charOrId: Character | number) {
    let chosen: Character | undefined;

    if (typeof charOrId === "number") {
      chosen = characters.find((c) => c.id === charOrId);
    } else {
      chosen = charOrId;
    }

    if (!chosen) return;

    // Only allow if it's actually our turn.
    // (Client-side guard. Server will enforce again.)
    if (
      !currentPlayer ||
      currentPlayer.name.toLowerCase() !== meName.trim().toLowerCase()
    ) {
      alert("It's not your turn.");
      return;
    }

    setPendingPick(chosen);
    setShowSlotModal(true);
  }

  //
  // ---------- Confirming the slot (client-side step 2 -> server POST) ----------
  //
  async function confirmSlot(slotName: string) {
    if (!pendingPick) return;
    if (!meName.trim()) {
      alert("Set your name first.");
      return;
    }

    try {
      const res = await fetch("/api/lobby/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actingName: meName.trim(),
          slotName,
          chosen: pendingPick,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Pick failed");
        return;
      }

      // success:
      // 1. locally remove that character from our visible pool
      setCharacters((prev) => prev.filter((c) => c.id !== pendingPick.id));

      // 2. close modal
      setPendingPick(null);
      setShowSlotModal(false);

      // 3. update lobby immediately with server response
      setLobby(data);
    } catch (err: any) {
      console.error("confirmSlot failed", err);
      alert("Server error when drafting");
    }
  }

  //
  // ---------- Undo button ----------
  //
  async function handleUndo() {
    try {
      const res = await fetch("/api/lobby/undo", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Undo failed");
        return;
      }
      setLobby(data);
    } catch (err) {
      console.error("undo failed", err);
    }
  }

  //
  // ---------- Export button ----------
  //
  function handleExport() {
    const data = {
      lobby,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "character-draft.json";
    a.click();
  }

  //
  // ---------- Loading screen for the giant pool ----------
  //
  if (loadingChars) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-900 text-neutral-400 text-lg">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-neutral-200 animate-spin" />
        <div>Fetching gigantic character pool…</div>
        <div className="text-xs text-neutral-600">
          (This is normal — we’re pulling tens of thousands)
        </div>
      </div>
    );
  }

  //
  // ---------- UI ----------
  //
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
      {/* HEADER / CONTROL BAR */}
      <header className="flex flex-wrap gap-4 items-start justify-between mb-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Anime Character Draft</h1>

          {/* identify yourself */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="text-xs text-neutral-400 flex flex-col">
              <span className="uppercase tracking-wide text-[10px] text-neutral-500">
                Your Name
              </span>
              <input
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white w-32"
                placeholder="Type name"
                value={meName}
                onChange={(e) => setMeName(e.target.value)}
              />
            </label>

            {currentPlayer && (
              <div className="text-xs bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-300 flex items-center gap-1">
                <span className="text-neutral-500 uppercase">On clock:</span>
                <span className="font-semibold text-white">
                  {currentPlayer.name}
                </span>
                <span className="text-neutral-500">(R{lobby.round})</span>
                <span className="font-mono text-white ml-1">
                  {clockDisplay}
                </span>
              </div>
            )}

            {lobby.lastPick && (
              <div className="text-[11px] text-neutral-500 leading-tight">
                Last pick:{" "}
                <span className="text-white">
                  {lobby.lastPick.playerName}
                </span>{" "}
                drafted {lobby.lastPick.char.name.full} as{" "}
                {lobby.lastPick.slot}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          <button
            onClick={handleUndo}
            className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm"
          >
            Undo
          </button>

          <button
            onClick={handleExport}
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
        {/* LEFT: PLAYERS / LOBBY STATE */}
        <aside className="space-y-4 overflow-y-auto max-h-[80vh] pr-1">
          {lobby.players.length === 0 && (
            <div className="text-neutral-600 text-sm italic">
              No players yet. Type your name above to join.
            </div>
          )}

          {lobby.players.map((p, i) => {
            const col = colorStyleForPlayer(p);
            const isOnClock = i === lobby.currentPlayerIndex;

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

        {/* RIGHT: CHARACTER POOL (local) */}
        <section className="overflow-y-auto max-h-[80vh] grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* header row with deep cut button */}
          <div className="md:col-span-2 flex items-start justify-between bg-neutral-800 border border-neutral-700 rounded-xl p-3">
            <div className="text-xs text-neutral-400 leading-tight">
              {filteredLocalPool.length} results
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

          {filteredLocalPool.map((c, idx) => (
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
                  onClick={() => beginDraftPick(c.id)}
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
      {showSlotModal && pendingPick && currentPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[400px] max-w-[90vw]">
            <h2 className="text-lg font-bold mb-2 text-white">
              Assign Slot
            </h2>
            <p className="text-sm text-neutral-400 mb-3">
              You're drafting{" "}
              <span className="text-white font-semibold">
                {pendingPick.name.full}
              </span>
              . Choose which slot you want to fill.
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {Object.entries(
                lobby.players[lobby.currentPlayerIndex]?.slots || {}
              )
                .filter(([_, v]) => !v) // only empty slots
                .map(([slotName]) => (
                  <button
                    key={slotName}
                    onClick={() => confirmSlot(slotName)}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm hover:bg-neutral-700 text-white text-left"
                  >
                    {slotName}
                  </button>
                ))}
            </div>

            <button
              onClick={() => {
                setShowSlotModal(false);
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
                            // same beginDraftPick logic but with full object instead of ID
                            // also check turn locally
                            beginDraftPick(c);
                            // close deep search modal, slot modal will open
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
