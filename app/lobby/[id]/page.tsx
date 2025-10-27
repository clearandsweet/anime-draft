"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { colorStyleForColor } from "../../lib/colors";

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
  startedAt: string | null;
  completedAt: string | null;

  // server should maintain this list:
  draftedIds?: number[];
};

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
  });

  const currentPlayer = lobby.players[lobby.currentPlayerIndex] || null;
  const onClockColor = colorStyleForColor(currentPlayer?.color);

  const clockDisplay = `${String(
    Math.floor(lobby.timerSeconds / 60)
  ).padStart(2, "0")}:${String(lobby.timerSeconds % 60).padStart(2, "0")}`;

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


  useEffect(() => {
    if (typeof window === "undefined") return;
    setPollLink(`${window.location.origin}/lobby/${lobbyId}/vote`);
  }, [lobbyId]);
  // load character pool
  useEffect(() => {
    async function loadSomePages() {
      setLoadingChars(true);
      const gathered: Character[] = [];
      let sawAny = false;
      for (let page = 1; page <= 100; page++) {
        try {
          const res = await fetch(`/api/characters?page=${page}`, { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          const chunk: Character[] = data?.characters || [];
          if (!chunk.length) break;
          gathered.push(...chunk);
          sawAny = true;
        } catch {}
      }
      if (sawAny) {
        const byId = new Map<number, Character>();
        for (const ch of gathered) if (!byId.has(ch.id)) byId.set(ch.id, ch);
        const finalList = Array.from(byId.values()).sort((a, b) => b.favourites - a.favourites);
        setCharacters(finalList);
      } else {
        if (characters.length === 0) setCharacters([]);
      }
      setLoadingChars(false);
    }
    loadSomePages();
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
        ...prev,
        ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch {}
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
        ...prev,
        ...data,
        draftedIds: data.draftedIds ?? prev.draftedIds ?? [],
        startedAt: data.startedAt ?? prev.startedAt ?? null,
        completedAt: data.completedAt ?? prev.completedAt ?? null,
      }));
    } catch {}
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
    } catch {}
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
        <div>Fetching character poolâ€¦</div>
        <div className="text-xs text-neutral-600">(Pulling top pages from AniList)</div>
      </div>
    );
  }

  if (!hasStarted) {
    const joinedCount = lobby.players.length;
    const target = lobby.targetPlayers;
    const readyToStart = joinedCount === target && joinedCount >= 2;
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
              "Waiting for first player to joinâ€¦"
            )}
          </div>
          <div className="mb-6">
            <div className="text-xs uppercase text-neutral-500 font-semibold mb-2 text-center">Number of Drafters</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {[2, 4, 8, 12].map((n) => {
                const active = n === lobby.targetPlayers;
                const canClick = isHost && !lobby.draftActive;
                return (
                  <button key={n} onClick={() => canClick && setTargetPlayers(n)} disabled={!canClick} className={`px-3 py-2 rounded-lg text-sm border ${active ? "border-fuchsia-500 text-white bg-fuchsia-600/20 shadow-[0_0_10px_rgba(217,70,239,0.6)]" : "border-neutral-700 text-neutral-300 bg-neutral-800"} ${canClick ? "hover:bg-neutral-700" : "opacity-50 cursor-not-allowed"}`}>
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-neutral-500 text-center mt-2">Joined {joinedCount}/{target}</div>
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
  const reconnectStrip = needReconnect ? (
    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-xs text-neutral-300 flex flex-wrap items-center gap-2 justify-between">
      <div className="flex-1">Reconnect: enter the exact name you used to join.</div>
      <input className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[11px] text-white w-[120px]" placeholder="Your name" value={meName} onChange={(e) => setMeName(e.target.value)} />
      <button className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[11px] hover:bg-neutral-700 text-white">Set</button>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 font-sans">
      <header className="mb-4 flex flex-col gap-3">
        {reconnectStrip}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className={["flex-1 min-w-[200px] text-center border rounded-xl px-4 py-3 bg-neutral-900 ring-2", onClockColor.ring].join(" ")}>
            <div className="text-sm font-bold text-white leading-tight flex flex-wrap items-center justify-center gap-2">
              <span className="uppercase text-[10px] tracking-wide text-neutral-500 font-semibold">On the Clock:</span>
              <span className="text-lg font-extrabold text-white">{currentPlayer ? currentPlayer.name : "(nobody)"}</span>
              <span className="text-[12px] text-neutral-400">R{lobby.round}</span>
              <span className="font-mono text-white text-[13px] bg-neutral-800/60 border border-neutral-700 rounded px-2 py-[2px]">{clockDisplay}</span>
            </div>
          </div>
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
          {iAmHost && (
            <button onClick={handleUndo} className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm">Undo (Host)</button>
          )}
          <button onClick={handleExport} className="bg-neutral-800 px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-700 text-sm ml-auto">Export</button>
        </div>
      </header>
      <main className="grid xl:grid-cols-[1fr_1fr] gap-4">
        <aside className="space-y-4 overflow-y-auto max-h-[80vh] pr-1">
          {lobby.players.map((p, i) => {
            const col = colorStyleForColor(p.color);
            const isOnClock = i === lobby.currentPlayerIndex;
            return (
              <div key={p.id} className={`rounded-xl border p-3 bg-neutral-900 ${isOnClock ? col.border : "border-neutral-700"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-neutral-500">{p.popularityTotal.toLocaleString()} â¤</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(p.slots).map(([slotName, charValue]) => {
                    const char = charValue as Character | null;
                    return (
                      <div key={slotName} className={`relative w-[90px] h-[120px] rounded border overflow-hidden ${col.glow} group`}>
                        {char ? (
                          <>
                            <img src={char.image.large} alt={char.name.full} className="w-full h-full object-cover" />
                            <div className={`absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] font-semibold text-center py-[3px] ${col.text}`}>{slotName}</div>
                            <div className="absolute inset-0 bg-black/80 text-[11px] text-white font-semibold flex items-center justify-center px-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">{char.name.full}</div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-[11px] font-semibold text-neutral-600 text-center leading-tight px-1">{slotName}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </aside>
        <section className="flex flex-col bg-neutral-900/0">
          <div
            className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-3 mb-3 shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
            style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: "rgba(23,23,23,0.9)", backdropFilter: "blur(4px)" }}
          >
            <div className="flex flex-wrap gap-4 items-start justify-between">
              <div className="flex flex-col">
                <label className="text-[10px] uppercase text-neutral-500 font-semibold">Gender</label>
                <select value={filters.gender} onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))} className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white">
                  <option>All</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Non-binary</option>
                  <option>Unknown</option>
                </select>
              </div>
              <div className="flex flex-col min-w-[180px] flex-1 max-w-[220px]">
                <label className="text-[10px] uppercase text-neutral-500 font-semibold">Search</label>
                <input value={filters.searchText} onChange={(e) => setFilters((f) => ({ ...f, searchText: e.target.value }))} placeholder="Character name" className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white w-full" />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase text-neutral-500 font-semibold">Can&apos;t Find Them?</label>
                <button onClick={() => { setShowDeepSearchModal(true); setDeepSearchQuery(""); setDeepSearchResults([]); }} className="text-[11px] font-semibold bg-gradient-to-r from-indigo-600/30 to-fuchsia-600/30 border border-fuchsia-500/40 text-fuchsia-300 rounded px-2 py-1 hover:from-indigo-600/40 hover:to-fuchsia-600/40 hover:text-white shadow-[0_0_10px_rgba(217,70,239,0.6)]">Deep Cut Search</button>
              </div>
              <div className="text-[10px] text-neutral-500 leading-tight">
                {filteredLocalPool.length} matches in local pool
                <br />
                total loaded: {characters.length}
              </div>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[70vh] pr-1 grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredLocalPool.map((c, idx) => (
              <div key={c.id} className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex gap-3">
                <img src={c.image.large} alt={c.name.full} className="w-20 h-28 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-neutral-100 truncate">{c.name.full}</div>
                  <div className="text-xs text-neutral-400 truncate">{c.name.native}</div>
                  <div className="text-xs text-neutral-500 mt-1">{c.gender} • ❤ {c.favourites.toLocaleString()}</div>
                  <button onClick={() => beginDraftPick(c.id)} className="mt-2 text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1 hover:bg-neutral-700">Pick #{idx + 1}</button>
                </div>
              </div>
            ))}
            {filteredLocalPool.length === 0 && (
              <div className="col-span-full text-center text-neutral-500 text-sm py-12">
                No local matches.
                <div className="mt-2 text-[11px] text-neutral-600">Try Deep Cut Search â†’ to pull from AniList directly.</div>
              </div>
            )}
          </div>
        </section>
      </main>

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
              {deepSearchLoading && <div className="text-neutral-500 text-sm italic">Searchingâ€¦</div>}
              {!deepSearchLoading && deepSearchResults.length === 0 && (<div className="text-neutral-600 text-sm italic">No results yet.</div>)}
              {!deepSearchLoading && deepSearchResults.length > 0 && (
                <div className="grid gap-2">
                  {deepSearchResults.map((c, idx) => (
                    <div key={c.id} className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex gap-3">
                      <img src={c.image.large} alt={c.name.full} className="w-16 h-20 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-100 truncate">{c.name.full}</div>
                        <div className="text-xs text-neutral-400 truncate">{c.name.native}</div>
                        <div className="text-xs text-neutral-500 mt-1">{c.gender} • ❤ {c.favourites.toLocaleString()}</div>
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
    </div>
  );
}



























