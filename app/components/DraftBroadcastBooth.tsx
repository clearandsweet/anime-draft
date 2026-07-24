"use client";

import { useEffect, useState } from "react";

type Props = {
  lobbyId: string;
  competitions?: string[];
};

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function DraftBroadcastBooth({ lobbyId, competitions = [] }: Props) {
  const options = competitions.length ? competitions : ["Fight"];
  const [competition, setCompetition] = useState(options[0]);
  const [result, setResult] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingArchive, setLoadingArchive] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadArchivedBroadcast() {
      setLoadingArchive(true);
      setError("");
      setResult("");
      setCreatedAt("");

      try {
        const query = new URLSearchParams({ lobbyId, competition });
        const response = await fetch(`/api/ai/judge?${query.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!cancelled && response.ok && data.result) {
          setResult(String(data.result));
          setCreatedAt(String(data.createdAt || ""));
        }
        if (!cancelled && !response.ok) {
          setError(data.error || "The broadcast archive is temporarily unavailable.");
        }
      } catch {
        if (!cancelled) {
          setError("The broadcast archive could not reach the server.");
        }
      } finally {
        if (!cancelled) setLoadingArchive(false);
      }
    }

    loadArchivedBroadcast();
    return () => {
      cancelled = true;
    };
  }, [competition, lobbyId]);

  async function generateBroadcast() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/ai/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyId, competition }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "The broadcast booth is temporarily offline.");
        return;
      }
      setResult(String(data.result || ""));
      setCreatedAt(String(data.createdAt || ""));
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
            Generate one playful sports-desk call per event. Once created, it is
            saved with this draft so every visitor sees the same archive.
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
            disabled={busy || loadingArchive || Boolean(result)}
            className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-cyan-950 transition hover:bg-cyan-300 disabled:cursor-default disabled:opacity-60"
          >
            {loadingArchive
              ? "Checking archive…"
              : busy
                ? "Calling the match…"
                : result
                  ? "Saved to archive"
                  : "Generate & archive"}
          </button>
        </div>
      </div>

      {(result || error) && (
        <div className="border-t border-neutral-800 bg-neutral-950/55 p-5">
          {error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-emerald-300">
                  Archived commentary
                </span>
                {createdAt && (
                  <span className="text-xs text-neutral-600">
                    Saved {formatSavedDate(createdAt)}
                  </span>
                )}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-200">
                {result}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
