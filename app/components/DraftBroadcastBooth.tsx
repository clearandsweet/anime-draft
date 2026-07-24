"use client";

import { useState } from "react";

type DraftCharacter = {
  name: { full: string };
};

type DraftPlayer = {
  id: string;
  name: string;
  slots: Record<string, DraftCharacter | null>;
};

type Props = {
  lobbyId: string;
  draftType: "anime" | "pokemon";
  players: DraftPlayer[];
  competitions?: string[];
};

export function DraftBroadcastBooth({
  lobbyId,
  draftType,
  players,
  competitions = [],
}: Props) {
  const options = competitions.length ? competitions : ["Overall draft showdown"];
  const [competition, setCompetition] = useState(options[0]);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function generateBroadcast() {
    setBusy(true);
    setError("");
    setResult("");

    try {
      const response = await fetch("/api/ai/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobby: { id: lobbyId, players },
          competition,
          draftType,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "The broadcast booth is temporarily offline.");
        return;
      }
      setResult(String(data.result || ""));
    } catch {
      setError("The broadcast booth could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/30 via-neutral-900/80 to-fuchsia-950/20">
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
            Experimental feature
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">AI Broadcast Booth</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Pick an event and get a playful, sports-desk-style call of the matchup.
            It is commentary, not an official result.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label>
            <span className="sr-only">Competition</span>
            <select
              value={competition}
              onChange={(event) => setCompetition(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-cyan-400 sm:w-48"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={generateBroadcast}
            disabled={busy}
            className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-cyan-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Calling the match…" : result ? "Run it again" : "Generate broadcast"}
          </button>
        </div>
      </div>

      {(result || error) && (
        <div className="border-t border-neutral-800 bg-neutral-950/55 p-5">
          {error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-200">{result}</div>
          )}
        </div>
      )}
    </section>
  );
}
