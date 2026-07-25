"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { colorStyleForColor } from "../lib/colors";
import { getDraftAwards } from "../lib/draftAwards";
import {
  getDraftRecapRoute,
  getDraftRecapText,
  getDraftRecapTitle,
} from "../lib/draftRecapShare";
import type { DraftPreset } from "./DraftPresetPicker";

type RecapCharacter = {
  id: number;
  name: { full: string; native?: string };
  image?: { large?: string };
  favourites?: number;
};

export type DraftHistoryEntry = {
  playerIndex: number;
  char: RecapCharacter;
  slot: string;
  previousRound?: number;
};

export type DraftRecapPlayer = {
  id: string;
  name: string;
  color: string;
};

type Props = {
  lobbyId: string;
  draftType: "anime" | "pokemon";
  players: DraftRecapPlayer[];
  history: DraftHistoryEntry[];
  preset?: DraftPreset;
  startedAt?: string | null;
  completedAt: string;
};

const PRESET_LABELS: Record<DraftPreset, string> = {
  classic: "Classic",
  blitz: "Blitz",
  chaos: "Chaos",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDuration(startedAt?: string | null, completedAt?: string | null) {
  if (!startedAt || !completedAt) return "Time not recorded";
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return "Time not recorded";

  const totalMinutes = Math.max(1, Math.round(durationMs / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function copyWithTextArea(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  return copied;
}

export function DraftRecap({
  lobbyId,
  draftType,
  players,
  history,
  preset = "classic",
  startedAt,
  completedAt,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [recapUrl, setRecapUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recap = useMemo(
    () =>
      history.map((entry, index) => ({
        ...entry,
        pickNumber: index + 1,
        round: entry.previousRound ?? Math.floor(index / Math.max(players.length, 1)) + 1,
        player: players[entry.playerIndex] ?? null,
        skipped: entry.slot === "AUTO_SKIP" || entry.char.id === -1,
      })),
    [history, players]
  );
  const awards = useMemo(
    () => getDraftAwards(history, players),
    [history, players]
  );

  const completedPicks = recap.filter((entry) => !entry.skipped).length;
  const skippedTurns = recap.length - completedPicks;
  const rounds = recap.reduce((maximum, entry) => Math.max(maximum, entry.round), 0);
  const visibleEntries = expanded ? recap : recap.slice(0, 12);
  const rematchPath = draftType === "pokemon" ? "/draft/pokemon" : "/draft";
  const rematchHref = `${rematchPath}?preset=${preset}&rematchOf=${encodeURIComponent(lobbyId)}`;
  const recapRoute = useMemo(
    () => getDraftRecapRoute(draftType, lobbyId),
    [draftType, lobbyId]
  );
  const recapTitle = getDraftRecapTitle(draftType, lobbyId);
  const recapText = useMemo(
    () =>
      getDraftRecapText({
        draftType,
        lobbyId,
        playerNames: players.map((player) => player.name),
        completedPicks,
        presetLabel: PRESET_LABELS[preset],
        awards,
      }),
    [awards, completedPicks, draftType, lobbyId, players, preset]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRecapUrl(`${window.location.origin}${recapRoute}`);
      setCanShare(typeof navigator.share === "function");
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, [recapRoute]);

  function showShareStatus(message: string) {
    setShareStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setShareStatus(""), 3000);
  }

  async function copyRecap() {
    if (!recapUrl) return;
    const value = `${recapTitle}\n${recapText}\n${recapUrl}`;
    let copied = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      // Some browsers expose clipboard access but block it until permission is granted.
    }

    if (!copied) {
      try {
        copied = copyWithTextArea(value);
      } catch {
        // The status message below points to the visible link as a manual fallback.
      }
    }

    showShareStatus(
      copied
        ? "Recap copied with results and link."
        : "Select the recap link below to copy it."
    );
  }

  async function shareRecap() {
    if (!recapUrl || typeof navigator.share !== "function") {
      await copyRecap();
      return;
    }

    try {
      await navigator.share({
        title: recapTitle,
        text: recapText,
        url: recapUrl,
      });
      showShareStatus("Recap ready to send.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyRecap();
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/70">
      <div className="border-b border-neutral-800 bg-gradient-to-r from-emerald-950/35 via-neutral-900 to-cyan-950/25 p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
              Permanent draft archive
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">How room #{lobbyId} unfolded</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Finished {formatDate(completedAt)} · {PRESET_LABELS[preset]} format
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={rematchHref}
              className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300"
            >
              Start a rematch
            </a>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Picks made", completedPicks.toString()],
            ["Rounds", rounds ? rounds.toString() : "—"],
            ["Skipped turns", skippedTurns.toString()],
            ["Draft time", formatDuration(startedAt, completedAt)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-950/55 p-3">
              <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>

        <section
          aria-labelledby={`share-recap-${draftType}-${lobbyId}`}
          className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                Shareable final recap
              </p>
              <h3
                id={`share-recap-${draftType}-${lobbyId}`}
                className="mt-1 text-sm font-semibold text-white"
              >
                Send the whole result, not just a link
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-400">
                Includes the format, player boards, pick total, award highlights,
                and this permanent results page.
              </p>
              <p className="mt-2 truncate font-mono text-[10px] text-neutral-500">
                {recapUrl || recapRoute}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={copyRecap}
                disabled={!recapUrl}
                className="rounded-lg border border-emerald-500 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-50"
              >
                Copy Full Recap
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={shareRecap}
                  className="rounded-lg border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800"
                >
                  Share Recap
                </button>
              )}
            </div>
          </div>
          <p
            aria-live="polite"
            className="mt-2 min-h-4 text-xs text-emerald-300"
          >
            {shareStatus}
          </p>
        </section>
      </div>

      <div className="p-5">
        {awards.length > 0 && (
          <section className="mb-8" aria-labelledby="draft-awards-heading">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-400">
                Automatic superlatives
              </p>
              <h3
                id="draft-awards-heading"
                className="mt-1 text-lg font-semibold text-white"
              >
                Draft Awards
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Memorable moments selected from the permanent pick log.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {awards.map((award) => {
                const color = colorStyleForColor(award.playerColor);

                return (
                  <article
                    key={award.id}
                    className={`overflow-hidden rounded-xl border bg-neutral-950/75 ${color.border}`}
                  >
                    <div className="flex min-h-24">
                      <div
                        aria-hidden="true"
                        className={`flex w-20 shrink-0 items-center justify-center border-r border-neutral-800 bg-neutral-900 bg-center ${
                          draftType === "pokemon"
                            ? "bg-contain bg-no-repeat"
                            : "bg-cover"
                        } text-xl font-black text-neutral-700`}
                        style={
                          award.imageUrl
                            ? { backgroundImage: `url(${award.imageUrl})` }
                            : undefined
                        }
                      >
                        {!award.imageUrl && award.pickNumber}
                      </div>
                      <div className="min-w-0 flex-1 p-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-400">
                          {award.title}
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-white">
                          {award.characterName}
                        </p>
                        <p className={`truncate text-xs ${color.text}`}>
                          {award.playerName}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-neutral-500">
                          Pick {award.pickNumber} · {award.slot}
                        </p>
                      </div>
                    </div>
                    <p className="border-t border-neutral-800 px-3 py-2 text-[10px] leading-relaxed text-neutral-500">
                      {award.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Pick log</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Draft recap</h3>
          </div>
          {recap.length > 12 && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition hover:bg-neutral-800"
            >
              {expanded ? "Show highlights" : `Show all ${recap.length} turns`}
            </button>
          )}
        </div>

        {recap.length ? (
          <ol className="grid gap-3 md:grid-cols-2">
            {visibleEntries.map((entry) => {
              const color = colorStyleForColor(entry.player?.color);
              return (
                <li
                  key={`${entry.pickNumber}-${entry.playerIndex}-${entry.slot}`}
                  className={`flex gap-3 rounded-xl border bg-neutral-950/75 p-3 ${color.border}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-black text-neutral-300">
                    {entry.pickNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                      Round {entry.round} · {entry.slot === "AUTO_SKIP" ? "No selection" : entry.slot}
                    </p>
                    <p className={`mt-1 truncate text-sm font-semibold ${color.text}`}>
                      {entry.player?.name || `Player ${entry.playerIndex + 1}`}
                    </p>
                    <p className="truncate text-sm text-white">
                      {entry.skipped ? "Turn skipped when the clock expired" : entry.char.name.full}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-neutral-800 p-5 text-sm leading-relaxed text-neutral-500">
            This draft’s final boards are preserved, but it predates the detailed pick log.
          </p>
        )}
      </div>
    </section>
  );
}
