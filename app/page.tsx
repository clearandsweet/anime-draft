"use client";

import React, { useState, useEffect, useMemo } from "react";

// TEMP data until AniList loads
const fakeAnimePool = [
  {
    id: 1,
    title: {
      english: "Fullmetal Alchemist: Brotherhood",
      romaji: "Hagane no Renkinjutsushi: Brotherhood",
    },
    coverImage: {
      large: "https://placehold.co/200x280?text=FMA:B",
    },
    seasonYear: 2009,
    format: "TV",
    popularity: 999999,
    episodes: 64,
    genres: ["Action", "Adventure", "Drama"],
  },
  {
    id: 2,
    title: {
      english: "Chainsaw Man",
      romaji: "Chainsaw Man",
    },
    coverImage: {
      large: "https://placehold.co/200x280?text=CSM",
    },
    seasonYear: 2022,
    format: "TV",
    popularity: 888888,
    episodes: 12,
    genres: ["Action", "Horror", "Dark Comedy"],
  },
];

const PLAYER_COLOR_KEYS = [
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

function makeInitialPlayers() {
  const shuffled = [...PLAYER_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    picks: [],
    popularityTotal: 0,
    color: PLAYER_COLOR_KEYS[i % PLAYER_COLOR_KEYS.length],
  }));
}

// color theming for each player
const COLOR_MAP: Record<
  string,
  {
    border: string;
    glow: string;
    text: string;
    badgeBg: string;
    badgeBorder: string;
  }
> = {
  rose: {
    border: "border-rose-500",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.4)]",
    text: "text-rose-400",
    badgeBg: "bg-rose-500/10",
    badgeBorder: "border-rose-500/40",
  },
  sky: {
    border: "border-sky-500",
    glow: "shadow-[0_0_20px_rgba(14,165,233,0.4)]",
    text: "text-sky-400",
    badgeBg: "bg-sky-500/10",
    badgeBorder: "border-sky-500/40",
  },
  emerald: {
    border: "border-emerald-500",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    text: "text-emerald-400",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/40",
  },
  amber: {
    border: "border-amber-400",
    glow: "shadow-[0_0_20px_rgba(251,191,36,0.4)]",
    text: "text-amber-400",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/30",
  },
  fuchsia: {
    border: "border-fuchsia-500",
    glow: "shadow-[0_0_20px_rgba(217,70,239,0.4)]",
    text: "text-fuchsia-400",
    badgeBg: "bg-fuchsia-500/10",
    badgeBorder: "border-fuchsia-500/40",
  },
  indigo: {
    border: "border-indigo-500",
    glow: "shadow-[0_0_20px_rgba(99,102,241,0.4)]",
    text: "text-indigo-400",
    badgeBg: "bg-indigo-500/10",
    badgeBorder: "border-indigo-500/40",
  },
  lime: {
    border: "border-lime-400",
    glow: "shadow-[0_0_20px_rgba(163,230,53,0.4)]",
    text: "text-lime-300",
    badgeBg: "bg-lime-500/10",
    badgeBorder: "border-lime-500/40",
  },
  cyan: {
    border: "border-cyan-400",
    glow: "shadow-[0_0_20px_rgba(34,211,238,0.4)]",
    text: "text-cyan-300",
    badgeBg: "bg-cyan-500/10",
    badgeBorder: "border-cyan-500/40",
  },
  fallback: {
    border: "border-neutral-700",
    glow: "",
    text: "text-neutral-300",
    badgeBg: "bg-neutral-700/30",
    badgeBorder: "border-neutral-500/50",
  },
};

function roundIsOdd(r: number) {
  return r % 2 === 1;
}

export default function Page() {
  // ---------- STATE ----------
  const [animePool, setAnimePool] = useState<any[]>(fakeAnimePool);
  const [players, setPlayers] = useState<any[]>(makeInitialPlayers);

  // snake draft state
  const [round, setRound] = useState<number>(1); // start round 1
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);

  // timer + last pick
  const [timerSeconds, setTimerSeconds] = useState<number>(180); // 3 min
  const [lastPick, setLastPick] = useState<null | {
    playerName: string;
    anime: any;
  }>(null);

  // filters
  const [filters, setFilters] = useState<{ year: string; searchText: string }>({
    year: "All",
    searchText: "",
  });

  // undo stack
  // each entry: { playerIndex, anime, round }
  const [history, setHistory] = useState<
    { playerIndex: number; anime: any; round: number }[]
  >([]);

  // current drafter
  const currentPlayer = players[currentPlayerIndex];

  // timer display mm:ss
  const clockDisplay =
    String(Math.floor(timerSeconds / 60)).padStart(2, "0") +
    ":" +
    String(timerSeconds % 60).padStart(2, "0");

  // ---------- HYDRATE REAL DATA FROM /api/anime ----------
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/anime", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.anime && Array.isArray(data.anime)) {
          data.anime.sort(
            (a: any, b: any) => (b.popularity || 0) - (a.popularity || 0)
          );
          setAnimePool(data.anime);
        }
      } catch (err) {
        console.error("Failed to load anime from AniList proxy:", err);
      }
    }
    load();
  }, []);

  // distinct years to populate dropdown
  const years = useMemo(() => {
    const ys = new Set(animePool.map((a) => a.seasonYear));
    return ["All", ...Array.from(ys).sort((a: any, b: any) => b - a)];
  }, [animePool]);

  // apply filters
  const filteredAnime = useMemo(() => {
    return animePool.filter((a) => {
      const yearMatch =
        filters.year === "All" || String(a.seasonYear) === String(filters.year);
      const textBlob = `${a.title.english || ""} ${
        a.title.romaji || ""
      } ${a.title.native || ""}`.toLowerCase();
      const searchMatch = textBlob.includes(
        filters.searchText.toLowerCase()
      );
      return yearMatch && searchMatch;
    });
  }, [animePool, filters]);

  // ---------- TIMER WITH AUTOPICK ----------
  useEffect(() => {
    const id = setInterval(() => {
      setTimerSeconds((t) => {
        if (t > 1) return t - 1;

        // timeout -> auto pick best available
        autopickIfNeeded();

        // reset timer for whoever's next
        return 180;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [animePool, players, currentPlayerIndex, round]);

  function getTopAvailableAnime() {
    if (animePool.length === 0) return null;
    const sorted = [...animePool].sort(
      (a, b) => (b.popularity || 0) - (a.popularity || 0)
    );
    return sorted[0] || null;
  }

  function autopickIfNeeded() {
    const top = getTopAvailableAnime();
    if (!top) return;
    performPick(top);
  }

  // ---------- DRAFT ACTION ----------
  function performPick(chosenAnime: any) {
    const drafterIndex = currentPlayerIndex;
    const drafter = players[drafterIndex];
    if (!drafter || !chosenAnime) return;

    // remove from pool
    setAnimePool((prev) => prev.filter((a) => a.id !== chosenAnime.id));

    // add to player's picks
    setPlayers((prev) =>
      prev.map((pl, i) =>
        i === drafterIndex
          ? {
              ...pl,
              picks: [...pl.picks, chosenAnime],
              popularityTotal:
                pl.popularityTotal + (chosenAnime.popularity || 0),
            }
          : pl
      )
    );

    // store last pick info
    setLastPick({ playerName: drafter.name, anime: chosenAnime });

    // log in undo history
    setHistory((prev) => [
      ...prev,
      {
        playerIndex: drafterIndex,
        anime: chosenAnime,
        round: round,
      },
    ]);

    // advance the turn
    advanceTurn();
  }

  function handleDraft(animeId: number) {
    const chosen = animePool.find((a) => a.id === animeId);
    if (!chosen) return;
    performPick(chosen);
  }

  // ---------- SNAKE TURN ORDER ----------
  function advanceTurn() {
    setTimerSeconds(180);

    setCurrentPlayerIndex((idx) => {
      const goingForward = roundIsOdd(round);

      const atEndForward = goingForward && idx === players.length - 1;
      const atEndBackward = !goingForward && idx === 0;

      if (atEndForward || atEndBackward) {
        // just finished a round
        setRound((r) => r + 1);
        // stay at the end so next round starts from here going opposite direction
        return goingForward ? players.length - 1 : 0;
      }

      // still same round, keep moving
      return goingForward ? idx + 1 : idx - 1;
    });
  }

  // ---------- UNDO LAST PICK ----------
  function handleUndo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const { playerIndex, anime: undoneAnime, round: prevRound } = last;

    // return anime to pool
    setAnimePool((prev) => [...prev, undoneAnime]);

    // remove from that player's picks + fix score
    setPlayers((prev) =>
      prev.map((pl, i) => {
        if (i !== playerIndex) return pl;
        const newPicks = pl.picks.filter((a: any) => a.id !== undoneAnime.id);
        const newPop =
          pl.popularityTotal - (undoneAnime.popularity || 0);
        return {
          ...pl,
          picks: newPicks,
          popularityTotal: newPop < 0 ? 0 : newPop,
        };
      })
    );

    // roll back turn/round
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setRound(prevRound);
    setCurrentPlayerIndex(playerIndex);

    // clear last pick banner (that pick no longer happened)
    setLastPick(null);

    // restart the clock for the restored drafter
    setTimerSeconds(180);
  }

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 grid grid-rows-[auto_1fr] gap-4 font-sans">
      {/* HEADER */}
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Anime Draft</h1>

            {/* on the clock */}
            <div className="text-xs bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-300 flex items-center gap-1">
              <span className="text-neutral-500 uppercase">On the clock:</span>
              <span className="font-semibold text-white">
                {currentPlayer?.name}
              </span>
              <span className="text-neutral-500">(R{round})</span>
            </div>

            {/* timer */}
            <div className="text-xs bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-300">
              Time left:{" "}
              <span className="font-mono text-white">{clockDisplay}</span>
            </div>
          </div>

          <p className="text-sm text-neutral-400 leading-tight">
            Build your ultimate lineup
          </p>

          {lastPick && (
            <div className="text-[11px] text-neutral-400 flex flex-wrap gap-2 items-center leading-tight">
              <span className="uppercase text-neutral-500">Last Pick:</span>
              <span className="text-neutral-100 font-semibold">
                {lastPick.playerName}
              </span>
              <span>drafted</span>
              <span className="text-neutral-100 font-medium">
                {lastPick.anime.title.english ||
                  lastPick.anime.title.romaji}
              </span>
              <span className="text-neutral-500">
                ({lastPick.anime.seasonYear})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          {/* UNDO */}
          <button
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm hover:bg-neutral-700"
            onClick={handleUndo}
          >
            Undo Last Pick
          </button>

          {/* EXPORT */}
          <button
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-sm hover:bg-neutral-700"
            onClick={() => {
              const exportData = { players, round };
              const blob = new Blob(
                [JSON.stringify(exportData, null, 2)],
                {
                  type: "application/json",
                }
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "anime-draft-export.json";
              a.click();
            }}
          >
            Export Rosters
          </button>
        </div>
      </header>

      {/* BODY */}
      <main className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4 min-h-0">
        {/* LEFT COLUMN: player rosters */}
        <aside className="bg-neutral-800/40 border border-neutral-700/50 rounded-2xl p-3 overflow-y-auto min-h-0 space-y-4">
          {players.map((p, i) => {
            const base = COLOR_MAP[p.color] || COLOR_MAP.fallback;
            const isOnClock = i === currentPlayerIndex;

            return (
              <div
                key={p.id}
                className={
                  "rounded-xl border p-3 bg-neutral-900 " +
                  (isOnClock
                    ? `${base.border} ${base.glow}`
                    : "border-neutral-700")
                }
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="font-semibold text-neutral-100 flex items-center gap-2">
                    <span>{p.name}</span>
                    {isOnClock && (
                      <span
                        className={
                          "text-[10px] font-bold uppercase rounded px-1 py-[1px] border " +
                          `${base.text} ${base.badgeBg} ${base.badgeBorder}`
                        }
                      >
                        On Clock
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-500 text-right leading-tight">
                    <div>{p.picks.length} picks</div>
                    <div className="text-[10px] text-neutral-600">
                      pop {p.popularityTotal || 0}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {p.picks.length === 0 && (
                    <div className="text-neutral-600 text-xs italic">
                      No picks yet
                    </div>
                  )}

                  {p.picks.map((anime: any) => (
                    <div
                      key={anime.id}
                      className="flex items-start gap-2 text-xs bg-neutral-800 rounded-lg p-2 border border-neutral-700/60"
                    >
                      <img
                        src={anime.coverImage.large}
                        alt={anime.title.english || anime.title.romaji}
                        className="w-14 h-20 object-cover rounded shadow-[0_0_12px_rgba(0,0,0,0.8)]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-100 leading-snug truncate text-[11px]">
                          {anime.title.english || anime.title.romaji}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate">
                          {anime.seasonYear} • {anime.format}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {anime.genres?.slice(0, 3).map((g: string) => (
                            <span
                              key={g}
                              className="text-[9px] leading-tight bg-neutral-900 border border-neutral-700 rounded px-1 py-[1px] text-neutral-400"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        {/* RIGHT COLUMN: big board */}
        <section className="flex flex-col min-h-0 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl p-4">
          {/* filters */}
          <div className="flex flex-wrap gap-3 items-end mb-4">
            {/* Year filter */}
            <div className="flex flex-col">
              <label className="text-xs text-neutral-400">Year</label>
              <select
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm"
                value={filters.year}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, year: e.target.value }))
                }
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Search box */}
            <div className="flex flex-col flex-1 min-w-[200px] max-w-[300px]">
              <label className="text-xs text-neutral-400">Search</label>
              <input
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm"
                placeholder="Title / タイトル / ローマ字"
                value={filters.searchText}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    searchText: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* anime list */}
          <div className="overflow-y-auto min-h-0 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {filteredAnime.map((anime: any, idx: number) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                rank={idx + 1}
                canDraft={true}
                onDraft={handleDraft}
              />
            ))}

            {filteredAnime.length === 0 && (
              <div className="text-neutral-500 text-sm col-span-full text-center py-12">
                No shows match that.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// card for each anime in big board
function AnimeCard({
  anime,
  rank,
  canDraft,
  onDraft,
}: {
  anime: any;
  rank: number;
  canDraft: boolean;
  onDraft: (id: number) => void;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex flex-col shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <div className="flex gap-3">
        <img
          src={anime.coverImage.large}
          alt={anime.title.english || anime.title.romaji}
          className="w-20 h-28 object-cover rounded"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold leading-snug text-neutral-100 truncate">
                {anime.title.english || anime.title.romaji}
              </div>
              <div className="text-[11px] text-neutral-400 leading-tight truncate">
                {anime.title.romaji}
              </div>
            </div>
            <div className="text-[10px] text-neutral-500 flex-shrink-0 text-right leading-tight">
              <div className="text-neutral-200 font-bold">#{rank}</div>
              <div>pop {anime.popularity}</div>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 mt-1 flex flex-wrap gap-2 leading-tight">
            <span>{anime.seasonYear}</span>
            <span>• {anime.format}</span>
            <span>• {anime.episodes} eps</span>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {anime.genres?.slice(0, 3).map((g: string) => (
              <span
                key={g}
                className="text-[9px] leading-tight bg-neutral-800 border border-neutral-700 rounded px-1 py-[1px] text-neutral-400"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[10px] uppercase text-neutral-500 font-medium">
          Draft
        </label>
        <div className="flex flex-wrap gap-2 mt-1">
          <button
            disabled={!canDraft}
            onClick={() => onDraft(anime.id)}
            className="text-[10px] bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 hover:bg-neutral-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Pick #{rank}
          </button>
        </div>
      </div>
    </div>
  );
}
