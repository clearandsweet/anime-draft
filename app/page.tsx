"use client";

import React, { useEffect, useMemo, useState } from "react";

// ---------- Types ----------

type Character = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

type Player = {
  id: string;
  name: string;
  color: string;
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
  targetPlayers: number;
  draftActive: boolean;
};

// slot names must match server
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

// player color styling
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
  default: {
    glow: "shadow-[0_0_10px_rgba(255,255,255,0.15)]",
    text: "text-neutral-300",
    border: "border-neutral-500",
  },
};

function colorStyleForPlayer(p: Player) {
  return COLOR_MAP[p.color] || COLOR_MAP["default"];
}

export default function CharacterDraftApp() {
  //
  // -------- Local-only client state --------
  //
  const [meName, setMeName] = useState<string>("");

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingChars, setLoadingChars] = useState<boolean>(true);

  const [filters, setFilters] = useState<{ searchText: string; gender: string }>(
    { searchText: "", gender: "All" }
  );

  // deep cut search modal state
  const [showDeepSearchModal, setShowDeepSearchModal] =
    useState<boolean>(false);
  const [deepSearchQuery, setDeepSearchQuery] = useState<string>("");
  const [deepSearchLoading, setDeepSearchLoading] = useState<boolean>(false);
  const [deepSearchResults, setDeepSearchResults] = useState<Character[]>([]);

  // slot selection modal
  const [showSlotModal, setShowSlotModal] = useState<boolean>(false);
  const [pendingPick, setPendingPick] = useState<Character | null>(null);

  // -------- Shared lobby state (server-polled) --------
  const [lobby, setLobby] = useState<LobbyState>({
    players: [],
    round: 1,
    currentPlayerIndex: 0,
    timerSeconds: 180,
    lastPick: null,
    history: [],
    targetPlayers: 4,
    draftActive: false,
  });

  // UI convenience
  const currentPlayer = lobby.players[lobby.currentPlayerIndex] || null;

  const clockDisplay = `${String(
    Math.floor(lobby.timerSeconds / 60)
  ).padStart(2, "0")}:${String(lobby.timerSeconds % 60).padStart(2, "0")}`;

  //
  // ---------- Load giant character pool locally ----------
  //
  useEffect(() => {
    async function loadAllPages() {
      try {
        setLoadingChars(true);

        const bigList: Character[] = [];
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

        const byId = new Map<number, Character>();
        for (const ch of bigList) {
          if (!byId.has(ch.id)) {
            byId.set(ch.id, ch);
          }
        }

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
  // ---------- Poll lobby state every second ----------
  // server also ticks timer when /state is fetched
  //
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/lobby/state", { cache: "no-store" });
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
  // ---------- Join lobby when I set my name ----------
  //
  const hasJoined = lobby.players.some(
    (p) => p.name.toLowerCase() === meName.trim().toLowerCase()
  );

  async function tryJoin() {
    if (!meName.trim()) return;
    try {
      const res = await fetch("/api/lobby/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: meName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Join failed");
      } else {
        setLobby(data);
      }
    } catch (err) {
      console.error("join lobby failed", err);
    }
  }

  async function setTargetPlayers(n: number) {
    try {
      const res = await fetch("/api/lobby/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayers: n }),
      });
      const data = await res.json();
      if (res.ok) {
        setLobby(data);
      }
    } catch (err) {
      console.error("setTargetPlayers failed", err);
    }
  }

  async function startDraft() {
    try {
      const res = await fetch("/api/lobby/start", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Cannot start draft");
      } else {
        setLobby(data);
      }
    } catch (err) {
      console.error("startDraft failed", err);
    }
  }

  //
  // ---------- Deep Cut Search ----------
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
  // ---------- Begin draft pick (client step 1) ----------
  //
  function beginDraftPick(charOrId: Character | number) {
    let chosen: Character | undefined;

    if (typeof charOrId === "number") {
      chosen = characters.find((c) => c.id === charOrId);
    } else {
      chosen = charOrId;
    }

    if (!chosen) return;

    if (!lobby.draftActive) {
      alert("Draft hasn't started yet.");
      return;
    }

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
  // ---------- Confirm slot, POST to server (client step 2) ----------
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

      // success: remove locally so I don't see them again
      setCharacters((prev) => prev.filter((c) => c.id !== pendingPick.id));

      setPendingPick(null);
      setShowSlotModal(false);

      // update local lobby snapshot
      setLobby(data);
    } catch (err: any) {
      console.error("confirmSlot failed", err);
      alert("Server error when drafting");
    }
  }

  //
  // ---------- Undo ----------
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
  // ---------- Export ----------
  //
  function handleExport() {
    const data = { lobby };
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
  // ---------- Derived filtered pool for the right column ----------
  //
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
  // ---------- Loading screen for first load of pool ----------
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
  // ---------- Pregame Lobby Modal (full-screen until draftActive = true) ----------
  //
  if (!lobby.draftActive) {
    const joinedCount = lobby.players.length;
    const target = lobby.targetPlayers;
    const readyToStart =
      joinedCount === target && joinedCount >= 2;

    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative">
          <h1 className="text-xl font-bold text-white text-center mb-4">
            Anime Character Draft Lobby
          </h1>

          {/* top row: target players selector */}
          <div className="mb-6">
            <div className="text-xs uppercase text-neutral-500 font-semibold mb-2 text-center">
              Number of Drafters
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {[2, 4, 8, 12].map((n) => {
                const active = n === lobby.targetPlayers;
                return (
                  <button
                    key={n}
                    onClick={() => setTargetPlayers(n)}
                    disabled={lobby.draftActive}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      active
                        ? "border-fuchsia-500 text-white bg-fuchsia-600/20 shadow-[0_0_10px_rgba(217,70,239,0.6)]"
                        : "border-neutral-700 text-neutral-300 bg-neutral-800 hover:bg-neutral-700"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-neutral-500 text-center mt-2">
              Joined {joinedCount}/{target}
            </div>
          </div>

          {/* middle row: name/join vs lobby list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* left: enter name / join */}
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4 min-h-[150px] flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">
                  Enter Your Name
                </div>

                {!hasJoined ? (
                  <>
                    <input
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-2 text-sm text-white mb-3"
                      placeholder="e.g. Kai"
                      value={meName}
                      onChange={(e) => setMeName(e.target.value)}
                    />
                    <button
                      onClick={tryJoin}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white hover:bg-neutral-700"
                    >
                      Join
                    </button>
                  </>
                ) : (
                  <div className="text-sm text-neutral-300">
                    You joined as{" "}
                    <span className="font-semibold text-white">
                      {meName}
                    </span>
                    .<br />
                    Waiting for everyone else…
                  </div>
                )}
              </div>

              <div className="text-[10px] text-neutral-500 mt-4">
                Once you join, your name will appear in the lobby and you'll
                be assigned a color.
              </div>
            </div>

            {/* right: joined lobby list */}
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4 min-h-[150px]">
              <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">
                Joined Lobby
              </div>

              {lobby.players.length === 0 && (
                <div className="text-neutral-600 text-sm italic">
                  Nobody yet.
                </div>
              )}

              <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {lobby.players.map((p, idx) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-neutral-100 flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          // just tint: crude mapping
                          p.color === "rose"
                            ? "bg-rose-500"
                            : p.color === "sky"
                            ? "bg-sky-500"
                            : p.color === "emerald"
                            ? "bg-emerald-500"
                            : p.color === "amber"
                            ? "bg-amber-400"
                            : p.color === "fuchsia"
                            ? "bg-fuchsia-500"
                            : p.color === "indigo"
                            ? "bg-indigo-500"
                            : p.color === "lime"
                            ? "bg-lime-400"
                            : p.color === "cyan"
                            ? "bg-cyan-400"
                            : "bg-neutral-500"
                        }`}
                      />
                      {p.name}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      #{idx + 1}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="text-[10px] text-neutral-500 mt-4">
                We’ll start once we hit the selected total.
              </div>
            </div>
          </div>

          {/* bottom row: start button */}
          <div className="flex justify-center">
            <button
              onClick={startDraft}
              disabled={!readyToStart}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                readyToStart
                  ? "border-emerald-500 text-white bg-emerald-600/20 shadow-[0_0_10px_rgba(16,185,129,0.6)] hover:bg-emerald-600/30"
                  : "border-neutral-700 text-neutral-500 bg-neutral-800 cursor-not-allowed"
              }`}
            >
              Start Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  //
  // ---------- Main Draft UI (once draftActive === true) ----------
  //
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
      {/* HEADER */}
      <header className="mb-4 flex flex-col gap-3">
        {/* row 1: On the Clock big + Last Pick on the right */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Big On the Clock block */}
          <div className="flex-1 text-center">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">
              On the Clock
            </div>
            {currentPlayer ? (
              <div className="text-2xl font-bold text-white leading-tight">
                {currentPlayer.name}
              </div>
            ) : (
              <div className="text-xl font-bold text-neutral-600">
                (nobody?)
              </div>
            )}
            <div className="text-xs text-neutral-400 mt-1">
              R{lobby.round} •{" "}
              <span className="font-mono text-white">{clockDisplay}</span>
            </div>
          </div>

          {/* Last Pick info on the right */}
          <div className="text-right flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">
              Last Pick
            </div>
            {lobby.lastPick ? (
              <div className="text-xs text-neutral-300 leading-tight">
                <span className="text-white font-semibold">
                  {lobby.lastPick.playerName}
                </span>{" "}
                took{" "}
                <span className="text-white font-semibold">
                  {lobby.lastPick.char.name.full}
                </span>{" "}
                as {lobby.lastPick.slot}
              </div>
            ) : (
              <div className="text-xs text-neutral-600 leading-tight">
                (none yet)
              </div>
            )}
          </div>
        </div>

        {/* row 2: Your Name / Undo / Export */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400 flex flex-col">
              <span className="uppercase tracking-wide text-[10px] text-neutral-500">
                You Are
              </span>
              <input
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white w-32"
                placeholder="Your name"
                value={meName}
                onChange={(e) => setMeName(e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
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
        </div>
      </header>

      {/* BODY */}
      <main className="grid xl:grid-cols-[1fr_1fr] gap-4">
        {/* LEFT: Rosters */}
        <aside className="space-y-4 overflow-y-auto max-h-[80vh] pr-1">
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

        {/* RIGHT: Filters + Deep Cut + Pool */}
        <section className="overflow-y-auto max-h-[80vh] flex flex-col gap-3">
          {/* Filters row */}
          <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-3">
            <div className="flex flex-wrap gap-3 items-end justify-between">
              {/* gender */}
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

              {/* search */}
              <div className="flex flex-col flex-1 min-w-[180px] max-w-[220px]">
                <label className="text-[10px] uppercase text-neutral-500 font-semibold">
                  Search
                </label>
                <input
                  value={filters.searchText}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      searchText: e.target.value,
                    }))
                  }
                  placeholder="Character name"
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white"
                />
              </div>

              {/* Deep Cut Search trigger */}
              <div className="flex flex-col">
                <label className="text-[10px] uppercase text-neutral-500 font-semibold">
                  Can't Find Them?
                </label>
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
            </div>

            <div className="text-[10px] text-neutral-500 mt-2">
              {filteredLocalPool.length} matches in local pool
            </div>
          </div>

          {/* character pool grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </div>
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
                .filter(([_, v]) => !v)
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
              they're super obscure.
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
                            beginDraftPick(c);
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
