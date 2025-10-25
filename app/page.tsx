"use client";

import React, { useState, useEffect, useMemo } from "react";

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

// formats a big popularity number like 16091565 -> "16.09M"
function formatPopularityMillions(pop: number) {
  const millions = pop / 1_000_000;
  return `${millions.toFixed(2)}M`;
}

export default function Page() {
  // initial placeholder pool shown for half a second before AniList loads in
  const [animePool, setAnimePool] = useState<any[]>([
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
  ]);

  const [players, setPlayers] = useState<any[]>(makeInitialPlayers);

  const [round, setRound] = useState<number>(1);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);

  const [timerSeconds, setTimerSeconds] = useState<number>(180);
  const [lastPick, setLastPick] = useState<null | {
    playerName: string;
    anime: any;
  }>(null);

  const [filters, setFilters] = useState<{ year: string; searchText: string }>({
    year: "All",
    searchText: "",
  });

  // history entries: { playerIndex, anime, round }
  const [history, setHistory] = useState<
    { playerIndex: number; anime: any; round: number }[]
  >([]);

  const currentPlayer = players[currentPlayerIndex];

  const clockDisplay =
    String(Math.floor(timerSeconds / 60)).padStart(2, "0") +
    ":" +
    String(timerSeconds % 60).padStart(2, "0");

  // fetch top anime data from our serverless route
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

  // unique years for dropdown
  const years = useMemo(() => {
    const ys = new Set(animePool.map((a) => a.seasonYear));
    return ["All", ...Array.from(ys).sort((a: any, b: any) => b - a)];
  }, [animePool]);

  // filtered pool
  const filteredAnime = useMemo(() => {
    return animePool.filter((a) => {
      const matchesYear =
        filters.year === "All" || String(a.seasonYear) === String(filters.year);
      const text = `${a.title.english || ""} ${
        a.title.romaji || ""
      } ${a.title.native || ""}`.toLowerCase();
      const matchesSearch = text.includes(filters.searchText.toLowerCase());
      return matchesYear && matchesSearch;
    });
  }, [animePool, filters]);

  // timer w/ auto-pick
  useEffect(() => {
    const id = setInterval(() => {
      setTimerSeconds((t) => {
        if (t > 1) return t - 1;

        autopickIfNeeded();
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

  // Draft action
  function performPick(chosenAnime: any) {
    const drafterIndex = currentPlayerIndex;
    const drafter = players[drafterIndex];
    if (!drafter || !chosenAnime) return;

    // remove from pool
    setAnimePool((prev) => prev.filter((a) => a.id !== chosenAnime.id));

    // give to player
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

    // announce last pick
    setLastPick({ playerName: drafter.name, anime: chosenAnime });

    // push history (for undo)
    setHistory((prev) => [
      ...prev,
      {
        playerIndex: drafterIndex,
        anime: chosenAnime,
        round: round,
      },
    ]);

    // move to next drafter
    advanceTurn();
  }

  function handleDraft(animeId: number) {
    const chosen = animePool.find((a) => a.id === animeId);
    if (!chosen) return;
    performPick(chosen);
  }

  // snake draft turn advance
  function advanceTurn() {
    setTimerSeconds(180);

    setCurrentPlayerIndex((idx) => {
      const goingForward = roundIsOdd(round);
      const atEndForward = goingForward && idx === players.length - 1;
      const atEndBackward = !goingForward && idx === 0;

      if (atEndForward || atEndBackward) {
        // end of round
        setRound((r) => r + 1);
        // we stay on same drafter index to start next round from that end
        return goingForward ? players.length - 1 : 0;
      }

      return goingForward ? idx + 1 : idx - 1;
    });
  }

  // undo last pick
  function handleUndo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const { playerIndex, anime: undoneAnime, round: prevRound } = last;

    // put anime back
    setAnimePool((prev) => [...prev, undoneAnime]);

    // remove from player's picks
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

    // roll back turn
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setRound(prevRound);
    setCurrentPlayerIndex(playerIndex);

    setLastPick(null);
    setTimerSeconds(180);
  }

  // figure out popularity min/max across all players
  const { minPop, maxPop } = useMemo(() => {
    if (players.length === 0) {
      return { minPop: 0, maxPop: 0 };
    }
    const pops = players.map((p) => p.popularityTotal || 0);
    return {
      minPop: Math.min(...pops),
      maxPop: Math.max(...pops),
    };
  }, [players]);

  // helper to color each player's popularity based on min/max
  function popularityColorClass(pop: number) {
    if (pop === maxPop && maxPop !== minPop) {
      // worst (highest demerits) -> red
      return "text-red-400";
    }
    if (pop === minPop && maxPop !== minPop) {
      // best (lowest demerits) -> green
      return "text-emerald-400";
    }
    return "text-neutral-300";
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-4 grid grid-rows-[auto_1fr] gap-4 font-sans">
      {/* HEADER */}
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Anime Draft</h1>

            {/* ON THE CLOCK */}
            <div className="text-xs bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-300 flex items-center gap-1">
              <span className="text-neutral-500 uppercase">On the clock:</span>
              <span className="font-semibold text-white">
                {currentPlayer?.name}
              </span>
              <span className="text-neutral-500">(R{round})</span>
            </div>

            {/* TIMER */}
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
        {/* LEFT: PLAYERS / ROSTERS */}
        <aside className="bg-neutral-800/40 border border-neutral-700/50 rounded-2xl p-3 overflow-y-auto min-h-0 space-y-4">
          {players.map((p, i) => {
            const base = COLOR_MAP[p.color] || COLOR_MAP.fallback;
            const isOnClock = i === currentPlayerIndex;

            // figure color class for demerits
            const demColor = popularityColorClass(p.popularityTotal || 0);

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
                {/* header row for player */}
                <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                  {/* left: name + badge */}
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

                  {/* right: counts & demerits */}
                  <div className="text-[10px] leading-tight text-right flex flex-col items-end">
                    <div className="text-neutral-400">
                      {p.picks.length} picks
                    </div>
                    <div className={`${demColor} font-semibold`}>
                      <span className="block text-[9px] uppercase text-neutral-500">
                        Popularity Demerits
                      </span>
                      <span className="text-[11px]">
                        {formatPopularityMillions(
                          p.popularityTotal || 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PICKS GRID */}
                <div className="max-w-[900px]">
                  {p.picks.length === 0 ? (
                    <div className="text-neutral-600 text-xs italic">
                      No picks yet
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {p.picks.map((anime: any) => (
                        <div
                          key={anime.id}
                          className="flex flex-col bg-neutral-800 border border-neutral-700/60 rounded-lg p-2 w-[180px] text-xs"
                        >
                          <div className="flex gap-2">
                            <img
                              src={anime.coverImage.large}
                              alt={
                                anime.title.english ||
                                anime.title.romaji
                              }
                              className="w-10 h-16 object-cover rounded shadow-[0_0_12px_rgba(0,0,0,0.8)]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-neutral-100 leading-snug text-[11px] truncate">
                                {anime.title.english ||
                                  anime.title.romaji}
                              </div>
                              <div className="text-[10px] text-neutral-500 truncate">
                                {anime.seasonYear} • {anime.format}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1 mt-2">
                            {anime.genres
                              ?.slice(0, 3)
                              .map((g: string) => (
                                <span
                                  key={g}
                                  className="text-[9px] leading-tight bg-neutral-900 border border-neutral-700 rounded px-1 py-[1px] text-neutral-400"
                                >
                                  {g}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </aside>

        {/* RIGHT: BIG BOARD */}
        <section className="flex flex-col min-h-0 bg-neutral-800/40 border border-neutral-700/50 rounded-2xl p-4">
          {/* FILTERS */}
          <div className="flex flex-wrap gap-3 items-end mb-4">
            {/* Year */}
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

            {/* Search */}
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

          {/* ANIME GRID */}
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
