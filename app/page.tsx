"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  hostName: string | null;
};

const COLOR_MAP: Record<
  string,
  { glow: string; text: string; border: string; ring: string }
> = {
  rose: {
    glow: "shadow-[0_0_10px_rgba(244,63,94,0.5)]",
    text: "text-rose-400",
    border: "border-rose-500",
    ring: "ring-rose-500/60 shadow-[0_0_16px_rgba(244,63,94,0.5)]",
  },
  sky: {
    glow: "shadow-[0_0_10px_rgba(14,165,233,0.5)]",
    text: "text-sky-400",
    border: "border-sky-500",
    ring: "ring-sky-500/60 shadow-[0_0_16px_rgba(14,165,233,0.5)]",
  },
  emerald: {
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    text: "text-emerald-400",
    border: "border-emerald-500",
    ring: "ring-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.5)]",
  },
  amber: {
    glow: "shadow-[0_0_10px_rgba(251,191,36,0.5)]",
    text: "text-amber-400",
    border: "border-amber-500",
    ring: "ring-amber-400/60 shadow-[0_0_16px_rgba(251,191,36,0.5)]",
  },
  fuchsia: {
    glow: "shadow-[0_0_10px_rgba(217,70,239,0.5)]",
    text: "text-fuchsia-400",
    border: "border-fuchsia-500",
    ring: "ring-fuchsia-500/60 shadow-[0_0_16px_rgba(217,70,239,0.5)]",
  },
  indigo: {
    glow: "shadow-[0_0_10px_rgba(99,102,241,0.5)]",
    text: "text-indigo-400",
    border: "border-indigo-500",
    ring: "ring-indigo-500/60 shadow-[0_0_16px_rgba(99,102,241,0.5)]",
  },
  lime: {
    glow: "shadow-[0_0_10px_rgba(163,230,53,0.5)]",
    text: "text-lime-400",
    border: "border-lime-500",
    ring: "ring-lime-500/60 shadow-[0_0_16px_rgba(163,230,53,0.5)]",
  },
  cyan: {
    glow: "shadow-[0_0_10px_rgba(34,211,238,0.5)]",
    text: "text-cyan-400",
    border: "border-cyan-500",
    ring: "ring-cyan-500/60 shadow-[0_0_16px_rgba(34,211,238,0.5)]",
  },
  default: {
    glow: "shadow-[0_0_10px_rgba(255,255,255,0.15)]",
    text: "text-neutral-300",
    border: "border-neutral-500",
    ring: "ring-neutral-500/60 shadow-[0_0_16px_rgba(255,255,255,0.15)]",
  },
};

function colorStyleForPlayer(p: Player | null) {
  if (!p) return COLOR_MAP["default"];
  return COLOR_MAP[p.color] || COLOR_MAP["default"];
}

export default function CharacterDraftApp() {
  // local identity (not in lobby state)
  const [meName, setMeName] = useState<string>("");

  // local character pool
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingChars, setLoadingChars] = useState<boolean>(true);

  // search / gender filters
  const [filters, setFilters] = useState<{ searchText: string; gender: string }>(
    { searchText: "", gender: "All" }
  );

  // deep cut modal
  const [showDeepSearchModal, setShowDeepSearchModal] =
    useState<boolean>(false);
  const [deepSearchQuery, setDeepSearchQuery] = useState<string>("");
  const [deepSearchLoading, setDeepSearchLoading] = useState<boolean>(false);
  const [deepSearchResults, setDeepSearchResults] = useState<Character[]>([]);

  // slot select modal
  const [showSlotModal, setShowSlotModal] = useState<boolean>(false);
  const [pendingPick, setPendingPick] = useState<Character | null>(null);

  // lobby (server-polled)
  const [lobby, setLobby] = useState<LobbyState>({
    players: [],
    round: 1,
    currentPlayerIndex: 0,
    timerSeconds: 180,
    lastPick: null,
    history: [],
    targetPlayers: 4,
    draftActive: false,
    hostName: null,
  });

  const currentPlayer =
    lobby.players[lobby.currentPlayerIndex] || null;

  const onClockColor = colorStyleForPlayer(currentPlayer);

  const clockDisplay = `${String(
    Math.floor(lobby.timerSeconds / 60)
  ).padStart(2, "0")}:${String(lobby.timerSeconds % 60).padStart(2, "0")}`;

  // am I in the lobby by name?
  const iAmJoined = lobby.players.some(
    (p) => p.name.toLowerCase() === meName.trim().toLowerCase()
  );
  const iAmHost =
    lobby.hostName &&
    meName.trim().toLowerCase() === lobby.hostName.toLowerCase();

  // ---------- load character pool (first ~10 pages, fallback safe) ----------
  useEffect(() => {
    async function loadSomePages() {
      setLoadingChars(true);
      const gathered: Character[] = [];

      for (let page = 1; page <= 10; page++) {
        try {
          const res = await fetch(`/api/characters?page=${page}`, {
            cache: "no-store",
          });
          if (!res.ok) break;
          const data = await res.json();
          const chunk: Character[] = data?.characters || [];
          if (!chunk.length) break;
          gathered.push(...chunk);
        } catch {
          break;
        }
      }

      if (gathered.length > 0) {
        const byId = new Map<number, Character>();
        for (const ch of gathered) {
          if (!byId.has(ch.id)) byId.set(ch.id, ch);
        }
        const finalList = Array.from(byId.values()).sort(
          (a, b) => b.favourites - a.favourites
        );
        setCharacters(finalList);
      } else {
        // fallback: leave any existing state instead of wiping to []
        if (characters.length === 0) {
          setCharacters([]);
        }
      }

      setLoadingChars(false);
    }

    loadSomePages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- poll lobby every second ----------
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

  // ---------- join lobby ----------
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

  // ---------- host-only: change target players ----------
  async function setTargetPlayers(n: number) {
    try {
      const res = await fetch("/api/lobby/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayers: n, meName: meName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setLobby(data);
      }
    } catch (err) {
      console.error("setTargetPlayers failed", err);
    }
  }

  // ---------- host-only: start draft ----------
  async function startDraft() {
    try {
      const res = await fetch("/api/lobby/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meName: meName.trim() }),
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

  // ---------- deep cut search ----------
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

  // ---------- begin pick ----------
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

  // ---------- confirm pick -> server POST ----------
  async function confirmSlot(slotName: string) {
    if (!pendingPick) return;
    if (!meName.trim()) {
      alert("Reconnect with your joined name first.");
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

      // success: remove locally
      setCharacters((prev) => prev.filter((c) => c.id !== pendingPick.id));

      setPendingPick(null);
      setShowSlotModal(false);
      setLobby(data);
    } catch (err) {
      console.error("confirmSlot failed", err);
      alert("Server error when drafting");
    }
  }

  // ---------- undo (host only) ----------
  async function handleUndo() {
    try {
      const res = await fetch("/api/lobby/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meName: meName.trim() }),
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

  // ---------- export ----------
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

  // ---------- filtered pool ----------
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

  // ---------- loading skeleton during first pool load ----------
  if (loadingChars) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-900 text-neutral-400 text-lg">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-neutral-200 animate-spin" />
        <div>Fetching character pool…</div>
        <div className="text-xs text-neutral-600">
          (Pulling top pages from AniList)
        </div>
      </div>
    );
  }

  // ---------- PRE-DRAFT LOBBY FULLSCREEN ----------
  if (!lobby.draftActive) {
    const joinedCount = lobby.players.length;
    const target = lobby.targetPlayers;
    const readyToStart = joinedCount === target && joinedCount >= 2;
    const isHost = iAmHost;

    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative">
          <h1 className="text-xl font-bold text-white text-center mb-4">
            Anime Character Draft Lobby
          </h1>

          {/* host info */}
          <div className="text-center text-[11px] text-neutral-400 mb-4">
            {lobby.hostName ? (
              <>
                Host:{" "}
                <span className="text-white font-semibold">
                  {lobby.hostName}
                </span>{" "}
                {isHost && (
                  <span className="text-emerald-400 font-semibold ml-1">
                    (You are Host)
                  </span>
                )}
              </>
            ) : (
              "Waiting for first player to join…"
            )}
          </div>

          {/* Number of drafters row */}
          <div className="mb-6">
            <div className="text-xs uppercase text-neutral-500 font-semibold mb-2 text-center">
              Number of Drafters
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {[2, 4, 8, 12].map((n) => {
                const active = n === lobby.targetPlayers;
                const canClick = isHost && !lobby.draftActive;
                return (
                  <button
                    key={n}
                    onClick={() => canClick && setTargetPlayers(n)}
                    disabled={!canClick}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      active
                        ? "border-fuchsia-500 text-white bg-fuchsia-600/20 shadow-[0_0_10px_rgba(217,70,239,0.6)]"
                        : "border-neutral-700 text-neutral-300 bg-neutral-800"
                    } ${
                      canClick
                        ? "hover:bg-neutral-700"
                        : "opacity-50 cursor-not-allowed"
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

          {/* join + lobby list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* left: join box */}
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4 min-h-[150px] flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">
                  Enter Your Name
                </div>

                {!iAmJoined ? (
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
                    <span className="text-white font-semibold">
                      {meName}
                    </span>
                    .<br />
                    Waiting for everyone else…
                  </div>
                )}
              </div>

              <div className="text-[10px] text-neutral-500 mt-4">
                Once you join, you're locked in that seat.
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
                Draft Host will press Start when the lobby count matches.
              </div>
            </div>
          </div>

          {/* start button */}
          <div className="flex justify-center">
            <button
              onClick={startDraft}
              disabled={!readyToStart || !isHost}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border ${
                readyToStart && isHost
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

  // ---------- RECONNECT STRIP (draft is active, but browser isn't identified) ----------
  const needReconnect = lobby.draftActive && !iAmJoined;
  const reconnectStrip = needReconnect ? (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-xs text-neutral-300 flex flex-wrap items-center gap-2 justify-between">
      <div className="flex-1">
        Reconnect: enter the exact name you used to join.
      </div>
      <input
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[11px] text-white w-[120px]"
        placeholder="Your name"
        value={meName}
        onChange={(e) => setMeName(e.target.value)}
      />
      <button
        className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[11px] hover:bg-neutral-700 text-white"
        onClick={() => {
          // just setting meName is enough; server already has us
          // nothing else to do here.
        }}
      >
        Set
      </button>
    </div>
  ) : null;

  // ---------- MAIN DRAFT UI ----------
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
      <header className="mb-4 flex flex-col gap-3">
        {reconnectStrip}

        {/* row: On the Clock pill + Last Pick */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* CLOCK PILL */}
          <div
            className={[
              "flex-1 min-w-[200px] text-center border rounded-xl px-4 py-3 bg-neutral-900 ring-2",
              onClockColor.ring,
            ].join(" ")}
          >
            <div className="text-sm font-bold text-white leading-tight flex flex-wrap items-center justify-center gap-2">
              <span className="uppercase text-[10px] tracking-wide text-neutral-500 font-semibold">
                On the Clock:
              </span>
              <span className="text-lg font-extrabold text-white">
                {currentPlayer ? currentPlayer.name : "(nobody)"}
              </span>
              <span className="text-[12px] text-neutral-400">
                R{lobby.round}
              </span>
              <span className="font-mono text-white text-[13px] bg-neutral-800/60 border border-neutral-700 rounded px-2 py-[2px]">
                {clockDisplay}
              </span>
            </div>
          </div>

          {/* LAST PICK */}
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

        {/* row: host controls / export */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {iAmHost && (
            <button
              onClick={handleUndo}
              className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm"
            >
              Undo (Host)
            </button>
          )}

          <button
            onClick={handleExport}
            className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm ml-auto"
          >
            Export
          </button>
        </div>
      </header>

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
                        className={`relative w-[90px] h-[120px] rounded border overflow-hidden ${col.glow} group`}
                      >
                        {char ? (
                          <>
                            <img
                              src={char.image.large}
                              alt={char.name.full}
                              className="w-full h-full object-cover"
                            />
                            {/* slot ribbon */}
                            <div
                              className={`absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] font-semibold text-center py-[3px] ${col.text}`}
                            >
                              {slotName}
                            </div>
                            {/* hover tooltip with char name */}
                            <div className="absolute inset-0 bg-black/80 text-[11px] text-white font-semibold flex items-center justify-center px-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {char.name.full}
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

              {/* deep cut */}
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

          {/* pool grid */}
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

      {/* SLOT SELECT MODAL */}
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
