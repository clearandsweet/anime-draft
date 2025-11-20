"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { colorStyleForColor } from "../../lib/colors";
import { DraftTimer } from "./components/DraftTimer";
import { PlayerList } from "./components/PlayerList";
import { CharacterPool } from "./components/CharacterPool";
import { ThanksgivingTheme } from "./components/ThanksgivingTheme";

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

import { LobbyState } from "../../api/lobby/logic";

export default function CharacterDraftApp() {
  const params = useParams<{ id: string }>();
  const lobbyId = String(params.id);

  // local identity: user types their name locally
  const [meName, setMeName] = useState<string>("");

  // local giant character pool
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

  // slot selection modal (after you click Pick)
  const [showSlotModal, setShowSlotModal] = useState<boolean>(false);
  const [pendingPick, setPendingPick] = useState<Character | null>(null);

  // lobby state fetched from server (who joined, whose turn, etc.)
  const boardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [downloadingBoards, setDownloadingBoards] = useState<Record<string, boolean>>({});
  const [pollCopied, setPollCopied] = useState(false);
  const [pollLink, setPollLink] = useState<string>("");
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
  } as any);

  const currentPlayer = lobby.players[lobby.currentPlayerIndex] || null;
  const onClockColor = colorStyleForColor(currentPlayer?.color);

  // am I in the lobby already?
  const iAmJoined = lobby.players.some(
    (p) => p.name.toLowerCase() === meName.trim().toLowerCase()
  );
  // am I host
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
    try {
      return new Date(lobby.completedAt).toLocaleString();
    } catch {
      return lobby.completedAt;
    }
  }, [lobby.completedAt]);

  const everyoneFull = useMemo(() => {
    if (!lobby.players.length) return false;
    return lobby.players.every((p) =>
      Object.values(p.slots).every((slot) => slot)
    );
  }, [lobby.players]);

  const canPromptFinish = useMemo(() => everyoneFull && !lobby.completedAt, [everyoneFull, lobby.completedAt]);
  const showCompletionModal = iAmHost && canPromptFinish && !completionDismissed;


  useEffect(() => {
    if (!everyoneFull) {
      setCompletionDismissed(false);
    }
  }, [everyoneFull]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPollLink(`${window.location.origin}/lobby/${lobbyId}/vote`);
  }, [lobbyId]);
  // load character pool incrementally
  useEffect(() => {
    let active = true;
    async function loadIncremental() {
      setLoadingChars(true);
      const byId = new Map<number, Character>();

      // Helper to update state safely
      const updateState = () => {
        if (!active) return;
        setCharacters((prev) => {
          // Merge new characters with existing ones to avoid overwriting deep search results or other state
          // Actually, deep search results are separate. But let's be safe.
          // Wait, setCharacters replaces the whole list.
          // The issue might be that if deep search runs, it might trigger something?
          // No, deep search uses `deepSearchResults`.
          // The user said "stops loading".
          // Maybe the browser pauses the background fetch if many requests happen?
          // Let's just make sure we are robust.
          const combined = new Map<number, Character>();
          prev.forEach(c => combined.set(c.id, c));
          byId.forEach(c => combined.set(c.id, c));
          return Array.from(combined.values()).sort((a, b) => b.favourites - a.favourites);
        });
      };

      for (let page = 1; page <= 200; page++) {
        if (!active) break;
        try {
          const res = await fetch(`/api/characters?page=${page}`, { cache: "no-store" });
          if (!res.ok) {
            // If rate limited or error, wait a bit longer then continue or break
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          const data = await res.json();
          const chunk: Character[] = data?.characters || [];

          if (!chunk.length) break; // No more characters

          let newOnes = 0;
          for (const ch of chunk) {
            if (!byId.has(ch.id)) {
              byId.set(ch.id, ch);
              newOnes++;
            }
          }

          // Update UI every page
          if (newOnes > 0) updateState();

          // First page loaded? Turn off "loading" spinner so user can start interacting
          if (page === 1) setLoadingChars(false);

          // Rate limit protection: wait 800ms between requests
          // AniList limit is 90/min, so ~666ms minimum. 800ms is safe.
          await new Promise((r) => setTimeout(r, 800));

        } catch (e) {
          console.error("Fetch error page", page, e);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (active) setLoadingChars(false);
    }

    loadIncremental();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // poll lobby
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/lobby/${lobbyId}/state`, { cache: "no-store" });
        if (!res.ok) return;
        const data: LobbyState = await res.json();
        setLobby((prev) => ({
          ...prev,
          ...data,
          draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
          startedAt: data.startedAt ?? prev.startedAt ?? null,
          completedAt: data.completedAt ?? prev.completedAt ?? null,
        }));
      } catch { }
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
        ...prev,
        ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch { }
  }

  async function setTargetPlayers(n: number) {
    try {
      const res = await fetch(`/api/lobby/${lobbyId}/target`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlayers: n, meName: meName.trim() }),
      });
      const data = await res.json();
      if (res.ok) setLobby((prev) => ({
        ...prev,
        ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch { }
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
        ...prev,
        ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch { }
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
        ...prev,
        ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch { }
  }

  async function runDeepSearch() {
    if (!deepSearchQuery.trim()) return;
    try {
      setDeepSearchLoading(true);
      const res = await fetch(`/api/searchCharacterByName?q=${encodeURIComponent(deepSearchQuery.trim())}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.characters)) setDeepSearchResults(data.characters);
      else setDeepSearchResults([]);
    } catch {
      setDeepSearchResults([]);
    } finally {
      setDeepSearchLoading(false);
    }
  }

  function beginDraftPick(charOrId: Character | number) {
    let chosen: Character | undefined;
    if (typeof charOrId === "number") chosen = characters.find((c) => c.id === charOrId);
    else chosen = charOrId;
    if (!chosen) return;
    if (!hasStarted) { alert("Draft hasn't started yet."); return; }
    if (!currentPlayer || currentPlayer.name.toLowerCase() !== meName.trim().toLowerCase()) { alert("It's not your turn."); return; }
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
        ...prev,
        ...data,
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
        ...prev,
        ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch { }
  }

  function handleExport() {
    const data = { lobby };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lobby-${lobbyId}.json`;
    a.click();
  }

  function handleCancelFinishPrompt() {
    setCompletionDismissed(true);
  }

  async function handleFinishDraft() {
    if (!iAmHost) return;
    if (!meName.trim()) {
      alert("Enter your host name first.");
      return;
    }
    try {
      setFinishingDraft(true);
      const res = await fetch(`/api/lobby/${lobbyId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meName: meName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Unable to finish draft");
        return;
      }
      setLobby((prev) => ({
        ...prev,
        ...data,
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
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#111827",
      });
      const player = lobby.players.find((p) => p.id === playerId) || null;
      const safeName = player
        ? player.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")
        : playerId;
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `draft-${lobbyId}-${safeName || playerId}.png`;
      anchor.click();
    } catch (err) {
      console.error("board export failed", err);
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
        const result = window.prompt("Copy this link", pollLink);
        if (result !== null) setPollCopied(true);
      }
    } catch (err) {
      console.error("copy poll link failed", err);
      alert("Unable to copy the vote link. You can copy it manually below.");
    }
  }
  const filteredLocalPool = useMemo(() => {
    const draftedSet = new Set(lobby.draftedIds || []);
    return characters.filter((c) => {
      if (draftedSet.has(c.id)) return false;
      const genderOK = filters.gender === "All" || (c.gender && c.gender.toLowerCase().includes(filters.gender.toLowerCase()));
      const textOK = `${c.name.full} ${c.name.native}`.toLowerCase().includes(filters.searchText.toLowerCase());
      return genderOK && textOK;
    });
  }, [characters, filters, lobby.draftedIds]);

  if (loadingChars) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-900 text-neutral-400 text-lg">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-neutral-200 animate-spin" />
        <div>Fetching character pool...</div>
        <div className="text-xs text-neutral-600">(Pulling top pages from AniList)</div>
      </div>
    );
  }

  if (!hasStarted) {
    const joinedCount = lobby.players.length;
    const readyToStart = joinedCount >= 1;
    const isHost = iAmHost;
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] relative">
          <h1 className="text-xl font-bold text-white text-center mb-4">Anime Character Draft Lobby #{lobbyId}</h1>
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
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4">
              <div className="text-xs uppercase text-neutral-500 font-semibold mb-2 text-center">Categories</div>
              <div className="flex justify-center gap-2 mb-3">
                <button
                  onClick={() => iAmHost && setCategoryMode("default")}
                  disabled={!iAmHost}
                  className={`px-3 py-1 rounded text-xs border ${lobby.categoryMode === "default" || !lobby.categoryMode ? "bg-fuchsia-600/20 border-fuchsia-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400"} ${iAmHost ? "hover:bg-neutral-800" : ""}`}
                >
                  Default
                </button>
                <button
                  onClick={() => iAmHost && setCategoryMode("random")}
                  disabled={!iAmHost}
                  className={`px-3 py-1 rounded text-xs border ${lobby.categoryMode === "random" ? "bg-fuchsia-600/20 border-fuchsia-500 text-white" : "bg-neutral-900 border-neutral-700 text-neutral-400"} ${iAmHost ? "hover:bg-neutral-800" : ""}`}
                >
                  Random 10
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
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4 flex flex-col items-center justify-center">
              <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Status</div>
              <div className="text-2xl font-bold text-white mb-1">{joinedCount} Joined</div>
              <div className="text-xs text-neutral-400">Waiting for host to start...</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4 min-h-[150px] flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Enter Your Name</div>
                {!iAmJoined ? (
                  <>
                    <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white" placeholder="e.g. Kira" value={meName} onChange={(e) => setMeName(e.target.value)} />
                    <button onClick={tryJoin} className="mt-2 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700">Join Lobby</button>
                  </>
                ) : (
                  <div className="text-sm text-emerald-400">Joined as {meName}</div>
                )}
              </div>
              <div className="text-[11px] text-neutral-500">Lobby Code: {lobbyId}</div>
            </div>
            <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4">
              <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Players</div>
              <div className="space-y-1">
                {lobby.players.map((p) => (
                  <div key={p.id} className="text-sm text-neutral-200 flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-[11px] text-neutral-500">{p.color}</span>
                  </div>
                ))}
                {!lobby.players.length && <div className="text-xs text-neutral-600">No players yet</div>}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <button onClick={startDraft} disabled={!iAmHost || !readyToStart} className={`px-4 py-2 rounded-lg border ${iAmHost && readyToStart ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 hover:bg-emerald-600/30" : "bg-neutral-800 border-neutral-700 text-neutral-400 opacity-60"}`}>
              Start Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const pollButtonLabel = pollCopied ? "Link Copied!" : "Copy Vote Link";
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
        <header className="max-w-6xl mx-auto flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white text-center">Draft #{lobbyId} Complete</h1>
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
              href={`/lobby/${lobbyId}/vote`}
              className="px-4 py-2 rounded-lg border border-fuchsia-500/60 text-sm text-fuchsia-300 hover:bg-fuchsia-600/20"
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
              value={pollLink || `/lobby/${lobbyId}/vote`}
              readOnly
              className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200"
            />
          </div>
        </header>

        <main className="mt-8 max-w-6xl mx-auto grid gap-6 xl:grid-cols-2">
          {lobby.players.map((p) => {
            const col = colorStyleForColor(p.color);
            const downloading = Boolean(downloadingBoards[p.id]);
            return (
              <div
                key={p.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4 shadow-[0_0_30px_rgba(0,0,0,0.45)]"
              >
                <div
                  ref={(el) => {
                    boardRefs.current[p.id] = el;
                  }}
                  className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-4"
                >
                  <div className={`flex items-center justify-between border-b pb-2 ${col.border}`}>
                    <div className="text-lg font-bold text-white">{p.name}</div>
                    <div className="text-xs text-neutral-400">Popularity: {p.popularityTotal.toLocaleString()}</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {Object.entries(p.slots).map(([slotName, charValue], index) => {
                      const char = charValue as Character | null;
                      return (
                        <div
                          key={slotName}
                          className="flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden"
                        >
                          <div className={`text-[10px] uppercase font-semibold text-center py-1 ${col.overlay} text-white`}>
                            {slotName}
                          </div>
                          <div className="aspect-[3/4] w-full bg-neutral-950 flex items-center justify-center">
                            {char ? (
                              <img src={char.image.large} alt={char.name.full} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[11px] text-neutral-600 px-2 text-center">Undrafted</span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-neutral-200 text-center px-2 py-2 bg-neutral-900">
                            {char ? char.name.full : "No pick"}
                          </div>
                          <div className="text-[10px] text-neutral-500 text-center pb-2">#{index + 1}</div>
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
  const needReconnect = lobby.draftActive && !iAmJoined;
  const reconnectModal = needReconnect ? (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2">Rejoin Draft</h2>
        <p className="text-neutral-400 mb-6">
          You are disconnected. Enter your name exactly as it was to rejoin.
        </p>
        <input
          className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-lg text-white mb-4 focus:border-fuchsia-500 outline-none"
          placeholder="Your Name"
          value={meName}
          onChange={(e) => setMeName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryJoin()}
        />
        <button
          onClick={tryJoin}
          className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 rounded-lg transition"
        >
          Rejoin Lobby
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans relative">
      <ThanksgivingTheme />
      <header className="mb-4 flex flex-col gap-3 relative z-10">
        {reconnectModal}
        {canPromptFinish && !iAmHost && !lobby.completedAt && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded px-3 py-2">
            Waiting for host {lobby.hostName ?? "(host)"} to finish the draft.
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <DraftTimer lobby={lobby} />
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
              <button onClick={handleUndo} className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm">Undo (Host)</button>
            )}
            {iAmHost && canPromptFinish && (
              <button
                onClick={() => {
                  setCompletionDismissed(false);
                }}
                className="px-3 py-1 rounded border border-emerald-500 text-sm text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30"
              >
                Finish Draft
              </button>
            )}
          </div>
          <button onClick={handleExport} className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm">Export</button>
        </div>
      </header>
      <main className="grid xl:grid-cols-[1fr_1fr] gap-4">
        <PlayerList
          lobby={lobby}
          downloadingBoards={downloadingBoards}
          onDownloadBoard={downloadBoardPng}
          boardRefs={boardRefs}
        />
        <CharacterPool
          characters={characters}
          filteredPool={filteredLocalPool}
          filters={filters}
          setFilters={setFilters}
          onPick={beginDraftPick}
          onDeepSearch={() => {
            setShowDeepSearchModal(true);
            setDeepSearchQuery("");
            setDeepSearchResults([]);
          }}
        />
      </main>

      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[420px] max-w-[90vw] text-center">
            <h2 className="text-lg font-bold text-white">All Slots Filled</h2>
            <p className="text-sm text-neutral-400 mt-2">
              Ready to move this lobby into post-draft voting?
            </p>
            {!iAmHost && (
              <p className="text-xs text-neutral-500 mt-3">Waiting for host {lobby.hostName ?? "(unknown)"} to finish the draft.</p>
            )}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={handleCancelFinishPrompt} className="px-3 py-2 text-sm border border-neutral-700 rounded hover:bg-neutral-800">
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

      {showSlotModal && pendingPick && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-lg font-bold mb-2 text-white">Choose Slot for {pendingPick.name.full}</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(lobby.players[lobby.currentPlayerIndex]?.slots || {}).map((slotName) => (
                <button key={slotName} onClick={() => confirmSlot(slotName)} className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700 text-left">{slotName}</button>
              ))}
            </div>
            <button onClick={() => { setShowSlotModal(false); setPendingPick(null); }} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300">Cancel</button>
          </div>
        </div>
      )}

      {showDeepSearchModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-bold mb-2 text-white">Deep Cut Character Search</h2>
            <p className="text-sm text-neutral-400 mb-3 leading-snug">Type part of their name. We&apos;ll query AniList directly, even if they&apos;re super obscure.</p>
            <div className="flex gap-2 mb-3">
              <input className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-2 text-sm text-white" placeholder="e.g. Rakushun" value={deepSearchQuery} onChange={(e) => setDeepSearchQuery(e.target.value)} />
              <button onClick={runDeepSearch} className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700 text-white">Search</button>
            </div>
            <div className="flex-1 overflow-y-auto border border-neutral-800 rounded p-2 bg-neutral-950/50">
              {deepSearchLoading && <div className="text-neutral-500 text-sm italic">Searching...</div>}
              {!deepSearchLoading && deepSearchResults.length === 0 && (<div className="text-neutral-600 text-sm italic">No results yet.</div>)}
              {!deepSearchLoading && deepSearchResults.length > 0 && (
                <div className="grid gap-2">
                  {deepSearchResults.map((c, idx) => (
                    <div key={c.id} className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex gap-3">
                      <img src={c.image.large} alt={c.name.full} className="w-16 h-20 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-100 truncate">{c.name.full}</div>
                        <div className="text-xs text-neutral-400 truncate">{c.name.native}</div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {c.gender} {"\u2022"} {"\u2764"} {c.favourites.toLocaleString()}
                        </div>
                        <button onClick={() => { beginDraftPick(c); setShowDeepSearchModal(false); }} className="mt-2 text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1 hover:bg-neutral-700">Pick #{idx + 1}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { setShowDeepSearchModal(false); setDeepSearchResults([]); setDeepSearchQuery(""); }} className="mt-4 text-xs text-neutral-500 hover:text-neutral-300 self-start">Close</button>
          </div>
        </div>
      )}
      <ThanksgivingTheme />
    </div>
  );
}





































