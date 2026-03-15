"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LobbyMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hostName: string | null;
  status: "active" | "completed";
  playersCount: number;
  lastPickAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function PokemonDraftLobbyPage() {
  const [hostName, setHostName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobbies, setLobbies] = useState<LobbyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => lobbies.filter((lobby) => lobby.status === "active").length,
    [lobbies]
  );

  async function refreshLobbies() {
    try {
      setLoading(true);
      const res = await fetch("/api/lobbies?draftType=pokemon", { cache: "no-store" });
      const data = await res.json();
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
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: hostName.trim() || undefined,
          draftType: "pokemon",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
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
    if (!id) return;
    window.location.href = `/pokemon-lobby/${id}`;
  }

  async function handleDelete(id: string) {
    const password = window.prompt("Enter deletion password:")?.trim() || "";
    if (!password) return;
    const confirmDelete = window.confirm(`Delete lobby #${id}? This cannot be undone.`);
    if (!confirmDelete) return;
    const res = await fetch(`/api/lobbies/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manageKey: password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Delete failed.");
      return;
    }
    setLobbies((prev) => prev.filter((lobby) => lobby.id !== id));
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-red-400">Pokémon Draft</p>
          <h1 className="text-3xl font-bold text-white mt-1">Create your own Pokémon draft</h1>
          <p className="text-sm text-neutral-400 mt-2">
            Start a room, share the lobby code, draft live across all generations and forms, then vote on the results.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Lobby Rooms</h2>
            <p className="text-sm text-neutral-400">
              Active rooms: {activeCount} · Completed rooms: {lobbies.length - activeCount}
            </p>
          </div>
          <button
            onClick={refreshLobbies}
            className="border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 rounded px-3 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        {lastCreatedId && (
          <div className="border border-red-400/30 bg-red-900/20 rounded-xl p-4">
            <p className="text-sm text-red-100 font-semibold">Lobby #{lastCreatedId} created.</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <form
            onSubmit={handleCreate}
            className="border border-neutral-800 bg-neutral-900 rounded-xl p-4 space-y-3"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-400">Create Room</p>
            <input
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm"
              placeholder="Host name (recommended)"
              value={hostName}
              onChange={(event) => setHostName(event.target.value)}
            />
            <button
              type="submit"
              disabled={createBusy}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2 rounded"
            >
              {createBusy ? "Creating..." : "Create Lobby"}
            </button>
          </form>

          <form
            onSubmit={handleJoin}
            className="border border-neutral-800 bg-neutral-900 rounded-xl p-4 space-y-3"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-400">Join by Code</p>
            <input
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-2 text-sm"
              placeholder="Lobby ID"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <button
              type="submit"
              className="w-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-2 rounded"
            >
              Open Lobby
            </button>
          </form>
        </div>

        <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400 mb-3">All Rooms</p>

          {loading ? (
            <p className="text-sm text-neutral-500">Loading lobbies...</p>
          ) : lobbies.length === 0 ? (
            <p className="text-sm text-neutral-500">No lobbies yet.</p>
          ) : (
            <div className="space-y-2">
              {lobbies.map((lobby) => {
                return (
                  <div
                    key={lobby.id}
                    className="border border-neutral-800 bg-neutral-950 rounded-lg px-3 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="text-sm">
                      <p className="font-semibold text-white">
                        #{lobby.id}{" "}
                        <span className="text-xs font-normal text-neutral-400">({lobby.status})</span>
                      </p>
                      <p className="text-xs text-neutral-500">
                        Host: {lobby.hostName || "n/a"} · Players: {lobby.playersCount}
                      </p>
                      <p className="text-xs text-neutral-600">
                        Updated: {formatDate(lobby.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/pokemon-lobby/${lobby.id}`}
                        className="border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded text-xs"
                      >
                        Open
                      </a>
                      <button
                        onClick={() => handleDelete(lobby.id)}
                        className="border border-red-500/40 bg-red-900/20 hover:bg-red-900/30 px-3 py-1.5 rounded text-xs text-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
