"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { colorStyleForColor } from "../../lib/colors";
import { DraftTimer } from "../../lobby/[id]/components/DraftTimer";
import { PlayerList } from "../../lobby/[id]/components/PlayerList";
import { PokemonPool, PokemonFilters } from "./components/PokemonPool";

import { LobbyState } from "../../api/lobby/logic";

type Pokemon = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

export default function PokemonDraftApp() {
  const params = useParams<{ id: string }>();
  const lobbyId = String(params.id);

  const [meName, setMeName] = useState<string>("");

  // full Pokemon pool (loaded once from /api/pokemon)
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [loadingPokemon, setLoadingPokemon] = useState<boolean>(true);

  // filters for the pool
  const [filters, setFilters] = useState<PokemonFilters>({
    searchText: "",
    type: "All",
    generation: "All",
  });

  // Pokédex deep search modal
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Pokemon[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // slot selection modal
  const [showSlotModal, setShowSlotModal] = useState<boolean>(false);
  const [pendingPick, setPendingPick] = useState<Pokemon | null>(null);

  const boardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [downloadingBoards, setDownloadingBoards] = useState<Record<string, boolean>>({});
  const [pollCopied, setPollCopied] = useState(false);
  const [pollLink, setPollLink] = useState<string>("");

  // random pick modal
  const [showRandomModal, setShowRandomModal] = useState<boolean>(false);
  const [randomPokemon, setRandomPokemon] = useState<Pokemon | null>(null);

  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [finishingDraft, setFinishingDraft] = useState(false);

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
    startedAt: null,
    completedAt: null,
    draftedIds: [],
    version: 0,
    draftType: "pokemon",
  } as any);

  const currentPlayer = lobby.players[lobby.currentPlayerIndex] || null;
  const onClockColor = colorStyleForColor(currentPlayer?.color);

  const iAmJoined = lobby.players.some(
    (p) => p.name.toLowerCase() === meName.trim().toLowerCase()
  );
  const iAmHost =
    lobby.hostName &&
    meName.trim().toLowerCase() === lobby.hostName.toLowerCase();

  const hasStarted = useMemo(
    () => Boolean(lobby.startedAt || lobby.draftActive),
    [lobby.startedAt, lobby.draftActive]
  );

  const isCompleted = useMemo(
    () => Boolean(lobby.completedAt && !lobby.draftActive),
    [lobby.completedAt, lobby.draftActive]
  );

  const completedAtDisplay = useMemo(() => {
    if (!lobby.completedAt) return null;
    try { return new Date(lobby.completedAt).toLocaleString(); } catch { return lobby.completedAt; }
  }, [lobby.completedAt]);

  const everyoneFull = useMemo(() => {
    if (!lobby.players.length) return false;
    return lobby.players.every((p) => Object.values(p.slots).every((slot) => slot));
  }, [lobby.players]);

  const canPromptFinish = useMemo(() => everyoneFull && !lobby.completedAt, [everyoneFull, lobby.completedAt]);
  const showCompletionModal = iAmHost && canPromptFinish && !completionDismissed;

  useEffect(() => {
    if (!everyoneFull) setCompletionDismissed(false);
  }, [everyoneFull]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPollLink(`${window.location.origin}/pokemon-lobby/${lobbyId}/vote`);
  }, [lobbyId]);

  // Load full Pokemon list once — PokeAPI via our proxy
  useEffect(() => {
    let active = true;
    async function loadPokemon() {
      setLoadingPokemon(true);
      try {
        const res = await fetch("/api/pokemon", { cache: "no-store" });
        if (!res.ok) {
          console.error("Pokemon API error:", res.status);
          return;
        }
        const data = await res.json();
        if (active && Array.isArray(data.pokemon)) {
          setPokemon(data.pokemon);
        }
      } catch (e) {
        console.error("Failed to load Pokemon:", e);
      } finally {
        if (active) setLoadingPokemon(false);
      }
    }
    loadPokemon();
    return () => { active = false; };
  }, []);

  // Poll lobby state
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/lobby/${lobbyId}/state`, { cache: "no-store" });
        if (!res.ok) return;
        const data: LobbyState = await res.json();
        setLobby((prev) => ({
          ...prev, ...data,
          draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
          startedAt: data.startedAt ?? prev.startedAt ?? null,
          completedAt: data.completedAt ?? prev.completedAt ?? null,
        }));
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [lobbyId]);

  async function tryJoin() {
    if (!meName.trim()) return;
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: meName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Join failed");
      else setLobby((prev) => ({
        ...prev, ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch {}
  }

  async function setCategoryMode(mode: "default" | "random") {
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, meName: meName.trim() }),
      });
      const data = await res.json();
      if (res.ok) setLobby((prev) => ({
        ...prev, ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch {}
  }

  async function startDraft() {
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meName: meName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Cannot start draft");
      else setLobby((prev) => ({
        ...prev, ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch {}
  }

  async function runPokedexSearch() {
    if (!searchQuery.trim()) return;
    try {
      setSearchLoading(true);
      setSearchError(null);
      const res = await fetch(
        `/api/searchPokemon?q=${encodeURIComponent(searchQuery.trim())}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        setSearchResults([]);
        setSearchError(data.error || "Search failed.");
      } else {
        setSearchResults(Array.isArray(data.pokemon) ? data.pokemon : []);
      }
    } catch (e: any) {
      setSearchResults([]);
      setSearchError(e.message || "Network error during search");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleTogglePause() {
    if (!iAmHost) return;
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meName: meName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to toggle pause");
      else setLobby((prev) => ({ ...prev, isPaused: data.isPaused, version: prev.version + 1 }));
    } catch {
      alert("Network error toggling pause");
    }
  }

  function beginDraftPick(pokemonOrId: Pokemon | number) {
    let chosen: Pokemon | undefined;
    if (typeof pokemonOrId === "number") chosen = pokemon.find((p) => p.id === pokemonOrId);
    else chosen = pokemonOrId;
    if (!chosen) return;
    if (!hasStarted) { alert("Draft hasn't started yet."); return; }
    if (!currentPlayer || currentPlayer.name.toLowerCase() !== meName.trim().toLowerCase()) {
      alert("It's not your turn."); return;
    }
    setPendingPick(chosen);
    setShowSlotModal(true);
  }

  async function confirmSlot(slotName: string) {
    if (!pendingPick) return;
    if (!meName.trim()) { alert("Reconnect with your joined name first."); return; }
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actingName: meName.trim(), slotName, chosen: pendingPick }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Pick failed"); return; }
      setLobby((prev) => ({
        ...prev, ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
      setPendingPick(null);
      setShowSlotModal(false);
    } catch {
      alert("Server error when drafting");
    }
  }

  async function handleUndo() {
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meName: meName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Undo failed"); return; }
      setLobby((prev) => ({
        ...prev, ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch {}
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify({ lobby }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pokemon-draft-${lobbyId}.json`;
    a.click();
  }

  async function handleFinishDraft() {
    if (!iAmHost) return;
    if (!meName.trim()) { alert("Enter your host name first."); return; }
    try {
      setFinishingDraft(true);
      const res = await fetch(`/api/lobby/${lobbyId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meName: meName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Unable to finish draft"); return; }
      setLobby((prev) => ({
        ...prev, ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
      setCompletionDismissed(true);
    } catch {
      alert("Server error finishing draft");
    } finally {
      setFinishingDraft(false);
    }
  }

  async function downloadBoardPng(playerId: string) {
    const node = boardRefs.current[playerId];
    if (!node) return;
    try {
      setDownloadingBoards((prev) => ({ ...prev, [playerId]: true }));
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: true, pixelRatio: 2, backgroundColor: "#111827",
      });
      const player = lobby.players.find((p) => p.id === playerId) || null;
      const safeName = player
        ? player.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")
        : playerId;
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `pokemon-draft-${lobbyId}-${safeName || playerId}.png`;
      anchor.click();
    } catch {
      alert("Unable to export board image right now.");
    } finally {
      setDownloadingBoards((prev) => ({ ...prev, [playerId]: false }));
    }
  }

  async function handleCopyPollLink() {
    if (!pollLink) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pollLink);
        setPollCopied(true);
      } else {
        window.prompt("Copy this link", pollLink);
        setPollCopied(true);
      }
    } catch {
      alert("Unable to copy the vote link.");
    }
  }

  // Filtered pool — exclude already-drafted Pokemon, apply filters
  const filteredPool = useMemo(() => {
    const draftedSet = new Set(lobby.draftedIds || []);
    return pokemon.filter((p) => {
      if (draftedSet.has(p.id)) return false;

      // Text search: name or Pokédex number
      if (filters.searchText) {
        const q = filters.searchText.toLowerCase();
        const matchesName = p.name.full.toLowerCase().includes(q);
        const matchesNumber = String(p.id).includes(q);
        if (!matchesName && !matchesNumber) return false;
      }

      // Type filter (stored in name.native)
      if (filters.type !== "All") {
        if (!p.name.native.toLowerCase().includes(filters.type.toLowerCase())) return false;
      }

      // Generation filter (stored in gender field)
      if (filters.generation !== "All") {
        if (p.gender !== filters.generation) return false;
      }

      return true;
    });
  }, [pokemon, filters, lobby.draftedIds]);

  function handleRandomPick() {
    if (filteredPool.length === 0) {
      alert("No Pokémon match your current filters.");
      return;
    }
    const idx = Math.floor(Math.random() * filteredPool.length);
    setRandomPokemon(filteredPool[idx]);
    setShowRandomModal(true);
  }

  // ─── Loading screen ────────────────────────────────────────────────────────
  if (loadingPokemon) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-900 text-neutral-400 text-lg">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-red-400 animate-spin" />
        <div>Loading Pokémon...</div>
        <div className="text-xs text-neutral-600">(Pulling all generations from PokéAPI)</div>
      </div>
    );
  }

  // ─── Pre-game lobby screen ─────────────────────────────────────────────────
  if (!hasStarted) {
    const joinedCount = lobby.players.length;
    const readyToStart = joinedCount >= 1;
    const isHost = iAmHost;
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative">
          <h1 className="text-xl font-bold text-white text-center mb-4">
            Pokémon Draft Lobby #{lobbyId}
          </h1>
          <div className="text-center text-[11px] text-neutral-400 mb-4">
            {lobby.hostName ? (
              <>
                Host: <span className="text-white font-semibold">{lobby.hostName}</span>
                {isHost && <span className="text-emerald-400 font-semibold ml-1">(You are Host)</span>}
              </>
            ) : (
              "Waiting for first player to join..."
            )}
          </div>

          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categories panel */}
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4">
              <div className="text-xs uppercase text-neutral-500 font-semibold mb-2 text-center">
                Categories
              </div>
              <div className="flex justify-center gap-2 mb-3">
                <button
                  onClick={() => iAmHost && setCategoryMode("random")}
                  disabled={!iAmHost}
                  className={`px-3 py-1 rounded text-xs border ${lobby.categoryMode === "random" ? "bg-red-600/20 border-red-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400"} ${iAmHost ? "hover:bg-neutral-800" : ""}`}
                >
                  Random 10
                </button>
                <button
                  onClick={() => iAmHost && setCategoryMode("default")}
                  disabled={!iAmHost}
                  className={`px-3 py-1 rounded text-xs border ${lobby.categoryMode === "default" ? "bg-red-600/20 border-red-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400"} ${iAmHost ? "hover:bg-neutral-800" : ""}`}
                >
                  Default 10
                </button>
              </div>
              <div className="flex flex-wrap gap-1 justify-center">
                {(lobby.slotNames || []).map((s) => (
                  <span key={s} className="text-[10px] px-2 py-1 bg-neutral-900 rounded border border-neutral-800 text-neutral-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Status panel */}
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4 flex flex-col items-center justify-center">
              <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Status</div>
              <div className="text-2xl font-bold text-white mb-1">{joinedCount} Joined</div>
              <div className="text-xs text-neutral-400">Waiting for host to start...</div>
              <div className="text-[11px] text-neutral-500 mt-2">
                {pokemon.length} Pokémon loaded
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Name entry */}
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4 min-h-[150px] flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Enter Your Name</div>
                {!iAmJoined ? (
                  <>
                    <input
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                      placeholder="e.g. Ash"
                      value={meName}
                      onChange={(e) => setMeName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && tryJoin()}
                    />
                    <button
                      onClick={tryJoin}
                      className="mt-2 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700"
                    >
                      Join Lobby
                    </button>
                  </>
                ) : (
                  <div className="text-sm text-emerald-400">Joined as {meName}</div>
                )}
              </div>
              <div className="text-[11px] text-neutral-500">Lobby Code: {lobbyId}</div>
            </div>

            {/* Players list */}
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4">
              <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Players</div>
              <div className="space-y-1">
                {lobby.players.map((p) => (
                  <div key={p.id} className="text-sm text-neutral-200 flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-[11px] text-neutral-500">{p.color}</span>
                  </div>
                ))}
                {!lobby.players.length && (
                  <div className="text-xs text-neutral-600">No players yet</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <button
              onClick={startDraft}
              disabled={!iAmHost || !readyToStart}
              className={`px-4 py-2 rounded-lg border ${iAmHost && readyToStart ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 hover:bg-emerald-600/30" : "bg-neutral-800 border-neutral-700 text-neutral-400 opacity-60"}`}
            >
              Start Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Completed screen ──────────────────────────────────────────────────────
  if (isCompleted) {
    const pollButtonLabel = pollCopied ? "Link Copied!" : "Copy Vote Link";
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
        <header className="max-w-6xl mx-auto flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white text-center">
              Pokémon Draft #{lobbyId} Complete
            </h1>
            <p className="text-center text-sm text-neutral-400 mt-1">
              {completedAtDisplay ? `Finished ${completedAtDisplay}` : "Finished just now"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleCopyPollLink}
              className={`px-4 py-2 rounded-lg border text-sm transition ${pollCopied ? "border-emerald-500 text-emerald-300 bg-emerald-600/20" : "border-neutral-700 bg-neutral-800 hover:bg-neutral-700"}`}
            >
              {pollButtonLabel}
            </button>
            <a
              href={`/pokemon-lobby/${lobbyId}/vote`}
              className="px-4 py-2 rounded-lg border border-red-500/60 text-sm text-red-300 hover:bg-red-600/20"
            >
              Open Voting Page
            </a>
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-sm"
            >
              Download JSON Snapshot
            </button>
          </div>
          <div className="max-w-lg mx-auto w-full">
            <label className="text-[11px] uppercase text-neutral-500 font-semibold">Shareable vote link</label>
            <input
              value={pollLink || `/pokemon-lobby/${lobbyId}/vote`}
              readOnly
              className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200"
            />
          </div>
        </header>

        <main className="mt-8 max-w-6xl mx-auto grid gap-6 xl:grid-cols-2 relative z-10">
          {lobby.players.map((p) => {
            const col = colorStyleForColor(p.color);
            const downloading = Boolean(downloadingBoards[p.id]);
            return (
              <div
                key={p.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4 shadow-[0_0_30px_rgba(0,0,0,0.45)]"
              >
                <div
                  ref={(el) => { boardRefs.current[p.id] = el; }}
                  className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4"
                >
                  <div className={`flex items-center justify-between border-b pb-2 ${col.border}`}>
                    <div className="text-lg font-bold text-white">{p.name}</div>
                    <div className="text-xs text-neutral-400">BST Total: {p.popularityTotal.toLocaleString()}</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {Object.entries(p.slots).map(([slotName, charValue], index) => {
                      const mon = charValue as Pokemon | null;
                      return (
                        <div
                          key={slotName}
                          className="flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden"
                        >
                          <div className={`text-[10px] uppercase font-semibold text-center py-1 ${col.overlay} text-white`}>
                            {slotName}
                          </div>
                          <div className="aspect-square w-full bg-neutral-950 flex items-center justify-center relative z-20 p-1">
                            {mon ? (
                              <img
                                src={mon.image.large}
                                alt={mon.name.full}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-[11px] text-neutral-600 px-2 text-center">Undrafted</span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-neutral-200 text-center px-2 py-1 bg-neutral-900 leading-tight">
                            {mon ? mon.name.full : "No pick"}
                          </div>
                          {mon && (
                            <div className="text-[10px] text-neutral-500 text-center pb-1">
                              {mon.name.native}
                            </div>
                          )}
                          <div className="text-[10px] text-neutral-600 text-center pb-2">#{index + 1}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => downloadBoardPng(p.id)}
                  className={`px-3 py-2 rounded-lg border text-sm transition ${downloading ? "border-neutral-700 bg-neutral-800 text-neutral-500 cursor-wait" : "border-neutral-700 bg-neutral-800 hover:bg-neutral-700"}`}
                  disabled={downloading}
                >
                  {downloading ? "Rendering..." : "Download PNG"}
                </button>
              </div>
            );
          })}
        </main>
        {!everyoneFull && (
          <p className="mt-6 text-center text-xs text-amber-400">
            Some slots are unfilled. PNGs will include placeholders where picks are missing.
          </p>
        )}
      </div>
    );
  }

  // ─── Active draft screen ───────────────────────────────────────────────────
  const needReconnect = lobby.draftActive && !iAmJoined;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-red-900 selection:text-white pb-20 relative">
      {/* Reconnect modal */}
      {needReconnect && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Rejoin Draft</h2>
            <p className="text-neutral-400 mb-6">
              You are disconnected. Enter your name exactly as it was to rejoin.
            </p>
            <input
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-lg text-white mb-4 focus:border-red-500 outline-none"
              placeholder="Your Name"
              value={meName}
              onChange={(e) => setMeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryJoin()}
            />
            <button
              onClick={tryJoin}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition"
            >
              Rejoin Lobby
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
        {canPromptFinish && !iAmHost && !lobby.completedAt && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded px-3 py-2">
            Waiting for host {lobby.hostName ?? "(host)"} to finish the draft.
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <DraftTimer lobby={lobby} isHost={Boolean(iAmHost)} onTogglePause={handleTogglePause} />
          <div className="text-right flex-1 min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">Last Pick</div>
            {lobby.lastPick ? (
              <div className="text-xs text-neutral-300 leading-tight">
                <span className="text-white font-semibold">{lobby.lastPick.playerName}</span>{" "}took{" "}
                <span className="text-white font-semibold">{lobby.lastPick.char.name.full}</span>{" "}as {lobby.lastPick.slot}
              </div>
            ) : (
              <div className="text-xs text-neutral-600 leading-tight">(none yet)</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {iAmHost && (
              <button onClick={handleUndo} className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm">
                Undo (Host)
              </button>
            )}
            {iAmHost && canPromptFinish && (
              <button
                onClick={() => setCompletionDismissed(false)}
                className="px-3 py-1 rounded border border-emerald-500 text-sm text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30"
              >
                Finish Draft
              </button>
            )}
          </div>
          <button onClick={handleExport} className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm">
            Export
          </button>
        </div>
      </header>

      <main className="grid xl:grid-cols-[1fr_1fr] gap-4">
        <PlayerList
          lobby={lobby}
          downloadingBoards={downloadingBoards}
          onDownloadBoard={downloadBoardPng}
          boardRefs={boardRefs}
        />
        <PokemonPool
          pokemon={pokemon}
          filteredPool={filteredPool}
          filters={filters}
          setFilters={setFilters}
          onPick={beginDraftPick}
          onSearch={() => {
            setShowSearchModal(true);
            setSearchQuery("");
            setSearchResults([]);
            setSearchError(null);
          }}
          onRandom={handleRandomPick}
        />
      </main>

      {/* Pokédex Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Pokédex Search</h3>
              <button onClick={() => setShowSearchModal(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 border-b border-neutral-800 bg-neutral-800/20">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-red-500 outline-none"
                  placeholder="Search by name or Pokédex # (e.g. Gengar or 94)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runPokedexSearch()}
                  autoFocus
                />
                <button
                  onClick={runPokedexSearch}
                  disabled={searchLoading}
                  className="bg-red-600 hover:bg-red-500 text-white font-semibold px-4 rounded-lg disabled:opacity-50"
                >
                  {searchLoading ? "..." : "Search"}
                </button>
              </div>
              <div className="text-[10px] text-neutral-500 mt-2">
                Searches PokéAPI directly. Works for any Pokémon by name or Pokédex number.
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
              {searchLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2">
                  <div className="w-6 h-6 border-2 border-neutral-600 border-t-red-400 rounded-full animate-spin" />
                  <div>Searching PokéAPI...</div>
                </div>
              ) : searchError ? (
                <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2">
                  <div className="text-lg">⚠</div>
                  <div className="text-center">{searchError}</div>
                  <button onClick={runPokedexSearch} className="text-xs underline hover:text-red-300">Try Again</button>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      className="bg-neutral-800/40 border border-neutral-700 rounded-lg p-2 flex gap-2 hover:bg-neutral-800 cursor-pointer transition"
                      onClick={() => { beginDraftPick(p); setShowSearchModal(false); }}
                    >
                      <img
                        src={p.image.large}
                        className="w-14 h-14 object-contain rounded bg-neutral-950"
                        alt={p.name.full}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{p.name.full}</div>
                        <div className="text-[10px] text-neutral-400">{p.name.native}</div>
                        <div className="text-[10px] text-neutral-500">#{p.id} · {p.gender}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-600">
                  {searchQuery ? "No results found." : "Enter a name or number to search."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finish draft modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[420px] max-w-[90vw] text-center">
            <h2 className="text-lg font-bold text-white">All Slots Filled</h2>
            <p className="text-sm text-neutral-400 mt-2">
              Ready to move to post-draft voting?
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setCompletionDismissed(true)}
                className="px-3 py-2 text-sm border border-neutral-700 rounded hover:bg-neutral-800"
              >
                Go Back
              </button>
              <button
                onClick={handleFinishDraft}
                disabled={!iAmHost || finishingDraft}
                className={`px-3 py-2 text-sm rounded border ${iAmHost && !finishingDraft ? "border-emerald-500 text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30" : "border-neutral-700 text-neutral-500 bg-neutral-800 cursor-not-allowed"}`}
              >
                {finishingDraft ? "Finishing..." : "Finish Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot selection modal */}
      {showSlotModal && pendingPick && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[500px] max-w-[90vw]">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={pendingPick.image.large}
                alt={pendingPick.name.full}
                className="w-16 h-16 object-contain bg-neutral-950 rounded"
              />
              <div>
                <h2 className="text-lg font-bold text-white">{pendingPick.name.full}</h2>
                <p className="text-xs text-neutral-400">{pendingPick.name.native} · {pendingPick.gender}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-400 mb-3">Choose a category slot:</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(lobby.players[lobby.currentPlayerIndex]?.slots || {}).map((slotName) => (
                <button
                  key={slotName}
                  onClick={() => confirmSlot(slotName)}
                  className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700 text-left"
                >
                  {slotName}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowSlotModal(false); setPendingPick(null); }}
              className="mt-4 text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Random pick modal */}
      {showRandomModal && randomPokemon && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[500px] max-w-[90vw] flex flex-col items-center text-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <h2 className="text-xl font-bold mb-1 text-white">Random Pick</h2>
            <p className="text-sm text-neutral-400 mb-6 uppercase tracking-wider font-semibold">From your current filters</p>
            <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl mb-6 flex flex-col items-center">
              <img
                src={randomPokemon.image.large}
                alt={randomPokemon.name.full}
                className="w-32 h-32 object-contain mb-3"
              />
              <div className="text-lg font-bold text-white">{randomPokemon.name.full}</div>
              <div className="text-xs text-neutral-400 mt-1">{randomPokemon.name.native}</div>
              <div className="text-xs text-neutral-500 mt-1">
                #{randomPokemon.id} · {randomPokemon.gender}
              </div>
            </div>
            <div className="flex w-full gap-3">
              <button
                onClick={() => {
                  const idx = Math.floor(Math.random() * filteredPool.length);
                  setRandomPokemon(filteredPool[idx]);
                }}
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white font-semibold hover:bg-neutral-700 transition"
              >
                Reroll
              </button>
              <button
                onClick={() => { setShowRandomModal(false); beginDraftPick(randomPokemon); }}
                className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg px-4 py-3 shadow-lg shadow-red-900/50 transition"
              >
                Select
              </button>
            </div>
            <button onClick={() => setShowRandomModal(false)} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
