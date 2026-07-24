"use client";

import { useMemo, useState } from "react";
import { colorStyleForColor } from "../lib/colors";
import type { DraftPreset } from "./DraftPresetPicker";

type RecapCharacter = {
  id: number;
  name: { full: string; native?: string };
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
  const [copied, setCopied] = useState(false);

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

  const completedPicks = recap.filter((entry) => !entry.skipped).length;
  const skippedTurns = recap.length - completedPicks;
  const rounds = recap.reduce((maximum, entry) => Math.max(maximum, entry.round), 0);
  const visibleEntries = expanded ? recap : recap.slice(0, 12);
  const rematchPath = draftType === "pokemon" ? "/draft/pokemon" : "/draft";
  const rematchHref = `${rematchPath}?preset=${preset}&rematchOf=${encodeURIComponent(lobbyId)}`;

  async function copyArchiveLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
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
            <button
              type="button"
              onClick={copyArchiveLink}
              className="rounded-lg border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800"
            >
              {copied ? "Link copied" : "Copy archive link"}
            </button>
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
      </div>

      <div className="p-5">
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
