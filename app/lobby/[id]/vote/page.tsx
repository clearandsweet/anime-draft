"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { colorStyleForColor } from "../../../lib/colors";
import { DraftBroadcastBooth } from "../../../components/DraftBroadcastBooth";
import {
  DraftRecap,
  type DraftHistoryEntry,
} from "../../../components/DraftRecap";
import type { DraftPreset } from "../../../components/DraftPresetPicker";
import { getRequiredVoteSelections } from "../../../api/lobby/votesLogic";
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
  history: DraftHistoryEntry[];
  preset?: DraftPreset;
  startedAt?: string | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [totals, setTotals] = useState<VoteTotals>({});
  const [ballots, setBallots] = useState(0);


  async function refresh() {
    try {
      setLoading(true);
      setLoadError(null);
      const [stateRes, votesRes] = await Promise.all([
        fetch(`/api/lobby/${lobbyId}/state`, { cache: "no-store" }),
        fetch(`/api/lobby/${lobbyId}/votes`, { cache: "no-store" }),
      ]);
      const stateData = await stateRes.json();
      const votesData = await votesRes.json();
      if (!stateRes.ok) {
        setLoadError(stateData.error || "Unable to load draft state.");
      } else {
        setLobby({
          players: Array.isArray(stateData.players) ? stateData.players : [],
          history: Array.isArray(stateData.history) ? stateData.history : [],
          preset: stateData.preset || "classic",
          startedAt: stateData.startedAt ?? null,
          completedAt: stateData.completedAt ?? null,
          competitions: stateData.competitions || ["Fight"],
        });
      }
      if (votesRes.ok) {
        setTotals(votesData.totals || {});
        setBallots(votesData.ballots || 0);
        setAlreadyVoted(Boolean(votesData.alreadyVoted));
      } else {
        setLoadError(votesData.error || "Unable to load voting details.");
      }
    } catch {
      setLoadError("Failed to load voting details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  useEffect(() => {
    if (!alreadyVoted) return;

    let active = true;
    async function refreshLiveResults() {
      try {
        const res = await fetch(`/api/lobby/${lobbyId}/votes`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!active || !res.ok) return;
        setTotals(data.totals || {});
        setBallots(data.ballots || 0);
      } catch {
        // Keep the last good standings during a temporary refresh failure.
      }
    }

    void refreshLiveResults();
    const intervalId = window.setInterval(refreshLiveResults, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [alreadyVoted, lobbyId]);

  const selectedMap = useMemo(() => {
    const map = new Map<string, number>();
    selected.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [selected]);

  const requiredSelections = getRequiredVoteSelections(
    lobby?.players.length ?? 0
  );
  const maxSelectable = requiredSelections;
  const canSubmit =
    requiredSelections > 0 &&
    selected.length === requiredSelections &&
    !submitting &&
    !alreadyVoted;
  const worstDemerit = useMemo(() => {
    if (!lobby?.players?.length) return 0;
    return Math.max(...lobby.players.map((p) => p.popularityTotal || 0));
  }, [lobby?.players]);
  const voteInstruction =
    requiredSelections === 1
      ? "Tap one board to assign your top pick, then submit your sealed ballot."
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
      setSubmitError(null);
      const payload = {
        first: selected[0] ?? null,
        second: requiredSelections >= 2 ? selected[1] ?? null : null,
        third: requiredSelections >= 3 ? selected[2] ?? null : null,
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
          setSubmitError(
            "This device already voted. Live results are now unlocked."
          );
        } else {
          setSubmitError(data.error || "Unable to record vote.");
        }
        return;
      }
      setTotals(data.totals || {});
      setBallots(data.ballots || 0);
      setAlreadyVoted(true);
      setSelected([]);
    } catch {
      setSubmitError("Network error submitting vote.");
    } finally {
      setSubmitting(false);
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

  if (loadError) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center p-6">
        <div className="bg-neutral-900 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg text-sm">
          {loadError}
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
            {submitError && (
              <p className="text-xs text-amber-300 mt-1" role="alert">
                {submitError}
              </p>
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

        {!alreadyVoted ? (
          <section className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-fuchsia-200">
                  Sealed results
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Community standings unlock after you submit, so every ballot stays independent.
                </p>
              </div>
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
                {ballots} {ballots === 1 ? "ballot" : "ballots"} sealed
              </span>
            </div>
          </section>
        ) : rankedTotals.length > 0 ? (
          <section className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-neutral-200 uppercase tracking-wide">
                Community Standings
              </h2>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
                <span>{ballots} {ballots === 1 ? "ballot" : "ballots"}</span>
              </div>
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
        ) : (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 text-sm text-neutral-400">
            Your ballot is recorded. Waiting for live standings…
          </section>
        )}

        <DraftRecap
          lobbyId={lobbyId}
          draftType="anime"
          players={lobby.players}
          history={lobby.history}
          preset={lobby.preset}
          startedAt={lobby.startedAt}
          completedAt={lobby.completedAt}
        />

        <DraftBroadcastBooth
          lobbyId={lobbyId}
          competitions={lobby.competitions}
        />

      </main>
      <ThanksgivingTheme />
    </div>
  );
}
