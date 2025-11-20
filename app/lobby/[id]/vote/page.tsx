"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { colorStyleForColor } from "../../../lib/colors";
import { ThanksgivingTheme } from "../components/ThanksgivingTheme";

type Character = {
  id: number;
  name: { full: string; native: string };
  image: { large: string };
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
  completedAt: string | null;
  competitions?: string[];
};

type VoteTotals = Record<
  string,
  { first: number; second: number; third: number; points: number }
>;

const PLACE_LABELS = ["1st Place", "2nd Place", "3rd Place"];

function sortByPoints(totals: VoteTotals, players: Player[]) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  return Object.entries(totals)
    .map(([playerId, tally]) => ({
      playerId,
      tally,
      player: playerMap.get(playerId) || null,
    }))
    .sort((a, b) => {
      if (b.tally.points !== a.tally.points) {
        return b.tally.points - a.tally.points;
      }
      return (b.player?.popularityTotal || 0) - (a.player?.popularityTotal || 0);
    });
}

export default function VoteDraftBoards() {
  const params = useParams<{ id: string }>();
  const lobbyId = String(params.id);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [totals, setTotals] = useState<VoteTotals>({});
  const [ballots, setBallots] = useState(0);
  const [judging, setJudging] = useState(false);
  const [judgeResult, setJudgeResult] = useState<string | null>(null);
  const [activeCompetition, setActiveCompetition] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const [stateRes, votesRes] = await Promise.all([
        fetch(`/api/lobby/${lobbyId}/state`, { cache: "no-store" }),
        fetch(`/api/lobby/${lobbyId}/votes`, { cache: "no-store" }),
      ]);
      const stateData = await stateRes.json();
      const votesData = await votesRes.json();
      if (!stateRes.ok) {
        setError(stateData.error || "Unable to load draft state.");
      } else {
        setLobby({
          players: Array.isArray(stateData.players) ? stateData.players : [],
          completedAt: stateData.completedAt ?? null,
          competitions: stateData.competitions || ["Fight"],
        });
      }
      if (votesRes.ok) {
        setTotals(votesData.totals || {});
        setBallots(votesData.ballots || 0);
        setAlreadyVoted(Boolean(votesData.alreadyVoted));
      }
    } catch {
      setError("Failed to load voting details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  const selectedMap = useMemo(() => {
    const map = new Map<string, number>();
    selected.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [selected]);

  const requiredSelections = lobby?.players.length === 2 ? 1 : 3;
  const maxSelectable = useMemo(
    () => Math.min(3, lobby?.players.length ?? 0),
    [lobby?.players]
  );
  const canSubmit = selected.length >= requiredSelections && !submitting && !alreadyVoted;
  const worstDemerit = useMemo(() => {
    if (!lobby?.players?.length) return 0;
    return Math.max(...lobby.players.map((p) => p.popularityTotal || 0));
  }, [lobby?.players]);
  const voteInstruction =
    requiredSelections === 1
      ? "Tap a board to assign your top pick. Submit once you've chosen at least one favorite."
      : "Tap boards to assign 1st, 2nd, and 3rd. Submit once all three picks are chosen.";

  function toggleSelection(playerId: string) {
    setSelected((prev) => {
      const idx = prev.indexOf(playerId);
      if (idx >= 0) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      if (prev.length >= maxSelectable) return prev;
      return [...prev, playerId];
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const payload = {
        first: selected[0] ?? null,
        second: lobby?.players.length === 2 ? null : selected[1] ?? null,
        third: lobby?.players.length === 2 ? null : selected[2] ?? null,
      };
      const res = await fetch(`/api/lobby/${lobbyId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setAlreadyVoted(true);
          setError("You have already voted from this device.");
        } else {
          setError(data.error || "Unable to record vote.");
        }
        return;
      }
      setTotals(data.totals || {});
      setBallots(data.ballots || 0);
      setAlreadyVoted(true);
      setSelected([]);
    } catch {
      setError("Network error submitting vote.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJudge(competition: string) {
    if (judging) return;
    setJudging(true);
    setJudgeResult(null);
    setActiveCompetition(competition);
    try {
      const res = await fetch("/api/ai/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobby, competition }),
      });
      const data = await res.json();
      if (data.result) {
        setJudgeResult(data.result);
      } else {
        setJudgeResult(`The judge is silent. (${data.error || "Unknown Error"})`);
      }
    } catch (e) {
      setJudgeResult(`The judge is silent. (Network Error: ${e})`);
    } finally {
      setJudging(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm">
          <div className="w-8 h-8 border-2 border-neutral-700 border-t-neutral-200 rounded-full animate-spin" />
          <span>Loading draft boards…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center p-6">
        <div className="bg-neutral-900 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!lobby?.completedAt) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center p-6">
        <div className="bg-neutral-900 border border-neutral-700 px-6 py-4 rounded-xl text-center space-y-2">
          <h1 className="text-lg font-semibold text-white">Voting Not Open Yet</h1>
          <p className="text-sm text-neutral-400">
            This draft is still in progress. Check back once every board is locked in.
          </p>
        </div>
      </div>
    );
  }

  const rankedTotals = sortByPoints(totals, lobby.players);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans relative">
      <header className="sticky top-0 z-30 bg-neutral-950/95 backdrop-blur border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Vote Draft #{lobbyId}</h1>
            <p className="text-xs text-neutral-500">{voteInstruction}</p>
            {alreadyVoted && (
              <p className="text-xs text-emerald-400 mt-1">Thanks! Your vote has been recorded.</p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded-lg border text-sm transition shadow-sm ${canSubmit
              ? "border-emerald-500 text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30"
              : "border-neutral-700 bg-neutral-900 text-neutral-500 cursor-not-allowed"
              }`}
          >
            {submitting ? "Submitting…" : alreadyVoted ? "Vote Submitted" : "Submit Vote"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10 relative z-10">
        <section className="grid gap-5 lg:grid-cols-2">
          {lobby.players.map((player) => {
            const col = colorStyleForColor(player.color);
            const placeIdx = selectedMap.get(player.id);
            const label = typeof placeIdx === "number" ? PLACE_LABELS[placeIdx] : null;
            const disabled = alreadyVoted;
            return (
              <div
                key={player.id}
                className={`relative border rounded-2xl overflow-hidden bg-neutral-900/80 backdrop-blur-sm transition ${label ? col.border : "border-neutral-800"
                  } ${disabled ? "opacity-80" : "cursor-pointer hover:border-fuchsia-500/60"}`}
                onClick={() => !disabled && toggleSelection(player.id)}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-white">{player.name}</div>
                    <div
                      className={`text-xs ${player.popularityTotal === worstDemerit && worstDemerit > 0
                        ? "text-red-400 font-semibold"
                        : "text-neutral-500"
                        }`}
                    >
                      Popularity Shame Demerits: {player.popularityTotal.toLocaleString()}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 auto-rows-fr">
                    {Object.entries(player.slots).map(([slotName, charValue]) => {
                      const char = charValue as Character | null;
                      return (
                        <div
                          key={slotName}
                          className="flex flex-col bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden h-full"
                        >
                          <div className="text-[10px] uppercase font-semibold text-center py-1 bg-neutral-900 text-neutral-400">
                            {slotName}
                          </div>
                          <div className="flex-1 bg-neutral-900 flex items-center justify-center">
                            {char ? (
                              <img
                                src={char.image.large}
                                alt={char.name.full}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[11px] text-neutral-600 px-2 text-center">
                                Empty
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-200 text-center px-2 py-2 bg-neutral-900">
                            {char ? char.name.full : "No pick"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {label && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center text-white font-bold text-lg ${col.overlay}`}
                  >
                    <div className="bg-black/50 px-4 py-2 rounded-xl shadow-lg">{label}</div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {rankedTotals.length > 0 && (
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide">
                Community Standings
              </h2>
              <span className="text-xs text-neutral-500">{ballots} ballots</span>
            </div>
            <div className="space-y-2">
              {rankedTotals.map(({ playerId, tally, player }, index) => {
                const col = colorStyleForColor(player?.color);
                const isWorst = player?.popularityTotal === worstDemerit && worstDemerit > 0;
                return (
                  <div
                    key={playerId}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm bg-neutral-900 ${col.border}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500 w-6 text-center">{index + 1}.</span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{player?.name || playerId}</span>
                        <span
                          className={`text-[11px] ${isWorst ? "text-red-400 font-semibold" : "text-neutral-500"
                            }`}
                        >
                          Shame Demerits: {player?.popularityTotal.toLocaleString() ?? "0"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <span className="text-neutral-300 font-semibold">{tally.points} pts</span>
                      <span>1st: {tally.first}</span>
                      <span>2nd: {tally.second}</span>
                      <span>3rd: {tally.third}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* AI Judge Section */}
        <section className="space-y-4 pt-8 border-t border-neutral-800">
          <h2 className="text-xl font-bold text-white">AI Judge</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {(lobby?.competitions?.length ? lobby.competitions : ["Fight"]).map((comp) => (
              <div key={comp} className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="font-semibold text-neutral-200 min-h-[3rem] flex items-center">
                  {comp}
                </div>
                <button
                  onClick={() => handleJudge(comp)}
                  disabled={judging}
                  className="w-full py-2.5 bg-fuchsia-600/20 border border-fuchsia-500/50 text-fuchsia-300 rounded-lg hover:bg-fuchsia-600/30 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {judging && activeCompetition === comp ? "Judging..." : "Judge Winner"}
                </button>
                {activeCompetition === comp && judgeResult && (
                  <div className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap bg-neutral-950 rounded-lg p-3 border border-neutral-800 animate-in fade-in slide-in-from-top-2">
                    {judgeResult}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      <ThanksgivingTheme />
    </div>
  );
}
