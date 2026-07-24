"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DraftPresetPicker,
  type DraftPreset,
} from "../../components/DraftPresetPicker";
import {
  DraftRoomBrowser,
  type LobbyMeta,
} from "../../components/DraftRoomBrowser";
import {
  forgetLobbyManagementKey,
  getLobbyManagementKey,
  ownedLobbyIds as findOwnedLobbyIds,
  rememberLobbyManagementKey,
} from "../../lib/lobbyOwnership";

export default function PokemonDraftLobbyPage() {
  const [hostName, setHostName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [preset, setPreset] = useState<DraftPreset>("classic");
  const [lobbies, setLobbies] = useState<LobbyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [rematchOf, setRematchOf] = useState<string | null>(null);
  const [ownedLobbyIds, setOwnedLobbyIds] = useState<Set<string>>(new Set());

  async function refreshLobbies() {
    try {
      setLoading(true);
      const response = await fetch("/api/lobbies?draftType=pokemon", {
        cache: "no-store",
      });
      const data = await response.json();
      const nextLobbies: LobbyMeta[] = Array.isArray(data.lobbies) ? data.lobbies : [];
      setLobbies(nextLobbies);
      setOwnedLobbyIds(findOwnedLobbyIds(nextLobbies.map((lobby) => lobby.id)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPreset = params.get("preset");
    if (
      requestedPreset === "classic" ||
      requestedPreset === "blitz" ||
      requestedPreset === "chaos"
    ) {
      setPreset(requestedPreset);
    }
    const requestedRematch = params.get("rematchOf");
    if (requestedRematch && /^\d+$/.test(requestedRematch)) {
      setRematchOf(requestedRematch);
    }
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
          draftType: "pokemon",
          preset,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to create lobby.");
        return;
      }
      const id = String(data.id);
      const ownershipSaved =
        typeof data.manageKey === "string" &&
        Boolean(data.manageKey) &&
        rememberLobbyManagementKey(id, data.manageKey);
      if (!ownershipSaved) {
        alert(
          "The room was created, but this browser blocked its ownership record. The room will remain protected from deletion."
        );
      }
      setLastCreatedId(id);
      setJoinCode(id);
      if (ownershipSaved) {
        setOwnedLobbyIds((current) => new Set([...current, id]));
      }
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
    if (id) window.location.href = `/pokemon-lobby/${id}`;
  }

  async function handleDelete(id: string) {
    const manageKey = getLobbyManagementKey(id);
    if (!manageKey) {
      alert("This browser does not own that room.");
      return;
    }
    if (!window.confirm(`Delete lobby #${id}? This cannot be undone.`)) return;

    const response = await fetch(`/api/lobbies/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manageKey }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(data.error || "Delete failed.");
      return;
    }
    forgetLobbyManagementKey(id);
    setLobbies((current) => current.filter((lobby) => lobby.id !== id));
    setOwnedLobbyIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.16),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(250,204,21,0.09),transparent_40%)]" />

      <main className="relative mx-auto max-w-6xl space-y-7 px-5 py-10">
        <header className="rounded-3xl border border-red-500/20 bg-neutral-900/75 p-6 shadow-2xl shadow-red-950/20 backdrop-blur md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-red-300">
                Clear &amp; Sweet Draft Lab
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Assemble a Pokémon squad nobody can counter.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 md:text-base">
                Draft across every generation and form, survive the timer, then archive
                the final teams for votes, bragging rights, and rematches.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 px-5 py-4 text-sm">
              <p className="text-neutral-500">Rooms in this lab</p>
              <p className="mt-1 text-2xl font-bold text-white">{lobbies.length}</p>
            </div>
          </div>
        </header>

        {rematchOf && !lastCreatedId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-4">
            <div>
              <p className="font-semibold text-cyan-100">
                Rematch setup for archived room #{rematchOf}
              </p>
              <p className="text-xs text-cyan-200/70">
                The original format is selected. Add a host name, then create the new room.
              </p>
            </div>
            <a
              href={`/pokemon-lobby/${rematchOf}/vote`}
              className="text-xs font-semibold text-cyan-200 underline decoration-cyan-500/50 underline-offset-4"
            >
              Back to archive
            </a>
          </div>
        )}

        {lastCreatedId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <div>
              <p className="font-semibold text-emerald-100">Room #{lastCreatedId} is ready.</p>
              <p className="text-xs text-emerald-200/70">
                {ownedLobbyIds.has(lastCreatedId)
                  ? "Share the number or jump in now. This browser securely owns room management."
                  : "Share the number or jump in now. The archive remains protected from deletion."}
              </p>
            </div>
            <a
              href={`/pokemon-lobby/${lastCreatedId}`}
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
              <p className="text-xs uppercase tracking-[0.18em] text-red-300">
                Create a room
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Pick your pace</h2>
            </div>

            <DraftPresetPicker value={preset} onChange={setPreset} accent="red" />

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Host name</span>
                <input
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-600 focus:border-red-400"
                  placeholder="Host name (recommended)"
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={createBusy}
                className="rounded-xl bg-red-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-60"
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
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-600 focus:border-red-400"
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
          basePath="/pokemon-lobby"
          accent="red"
          ownedLobbyIds={ownedLobbyIds}
          onDelete={handleDelete}
        />
      </main>
    </div>
  );
}
