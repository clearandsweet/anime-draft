"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DraftPresetPicker,
  type DraftPreset,
} from "../components/DraftPresetPicker";
import {
  DraftRoomBrowser,
  type LobbyMeta,
} from "../components/DraftRoomBrowser";

export default function DraftLobbyPage() {
  const [hostName, setHostName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [preset, setPreset] = useState<DraftPreset>("classic");
  const [lobbies, setLobbies] = useState<LobbyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  async function refreshLobbies() {
    try {
      setLoading(true);
      const response = await fetch("/api/lobbies?draftType=anime", {
        cache: "no-store",
      });
      const data = await response.json();
      setLobbies(Array.isArray(data.lobbies) ? data.lobbies : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshLobbies();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    try {
      setCreateBusy(true);
      const response = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: hostName.trim() || undefined,
          draftType: "anime",
          preset,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to create lobby.");
        return;
      }
      const id = String(data.id);
      setLastCreatedId(id);
      setJoinCode(id);
      await refreshLobbies();
    } catch {
      alert("Server error creating lobby.");
    } finally {
      setCreateBusy(false);
    }
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const id = joinCode.trim();
    if (id) window.location.href = `/lobby/${id}`;
  }

  async function handleDelete(id: string) {
    const password = window.prompt("Enter deletion password:")?.trim() || "";
    if (!password) return;
    if (!window.confirm(`Delete lobby #${id}? This cannot be undone.`)) return;

    const response = await fetch(`/api/lobbies/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manageKey: password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data.error || "Delete failed.");
      return;
    }
    setLobbies((current) => current.filter((lobby) => lobby.id !== id));
  }

  return (
    <div className="min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_20%_10%,rgba(217,70,239,0.16),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.12),transparent_40%)]" />

      <main className="relative mx-auto max-w-6xl space-y-7 px-5 py-10">
        <header className="rounded-3xl border border-fuchsia-500/20 bg-neutral-900/75 p-6 shadow-2xl shadow-fuchsia-950/20 backdrop-blur md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300">
                Clear &amp; Sweet Draft Lab
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Build the most unhinged anime roster in the room.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 md:text-base">
                Pick a format, invite your friends, snake-draft live, and preserve the
                final board for voting and post-game chaos.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 px-5 py-4 text-sm">
              <p className="text-neutral-500">Rooms in this lab</p>
              <p className="mt-1 text-2xl font-bold text-white">{lobbies.length}</p>
            </div>
          </div>
        </header>

        {lastCreatedId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <div>
              <p className="font-semibold text-emerald-100">Room #{lastCreatedId} is ready.</p>
              <p className="text-xs text-emerald-200/70">Share the number or jump in now.</p>
            </div>
            <a
              href={`/lobby/${lastCreatedId}`}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-emerald-950 transition hover:bg-emerald-300"
            >
              Enter room
            </a>
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[1.5fr_0.75fr]">
          <form
            onSubmit={handleCreate}
            className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900/75 p-5 backdrop-blur"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-300">
                Create a room
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Pick your pace</h2>
            </div>

            <DraftPresetPicker value={preset} onChange={setPreset} accent="fuchsia" />

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Host name</span>
                <input
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-600 focus:border-fuchsia-400"
                  placeholder="Host name (recommended)"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={createBusy}
                className="rounded-xl bg-fuchsia-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-400 disabled:opacity-60"
              >
                {createBusy ? "Creating…" : `Create ${preset} room`}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleJoin}
            className="flex flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/75 p-5"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">
                Have a code?
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Join a draft</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                Enter the room number your host shared. Your name is chosen inside.
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <input
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-600 focus:border-fuchsia-400"
                placeholder="Room number"
                inputMode="numeric"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
              />
              <button
                type="submit"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
              >
                Open lobby
              </button>
            </div>
          </form>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Room browser
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">Drafts past and present</h2>
          </div>
          <button
            type="button"
            onClick={refreshLobbies}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800"
          >
            Refresh rooms
          </button>
        </div>

        <DraftRoomBrowser
          lobbies={lobbies}
          loading={loading}
          basePath="/lobby"
          accent="fuchsia"
          onDelete={handleDelete}
        />
      </main>
    </div>
  );
}
