"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LobbyMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hostName: string | null;
  status: "active" | "completed";
  playersCount: number;
  lastPickAt: string | null;
};

export default function Landing() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [targetPlayers, setTargetPlayers] = useState<number>(4);
  const [joinCode, setJoinCode] = useState("");
  const [lobbies, setLobbies] = useState<LobbyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshLobbies() {
    try {
      setLoading(true);
      const res = await fetch("/api/lobbies", { cache: "no-store" });
      const data = await res.json();
      setLobbies(Array.isArray(data.lobbies) ? data.lobbies : []);
    } catch (e) {
      setError("Failed to load lobbies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshLobbies();
  }, []);

  async function handleCreate() {
    try {
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: hostName.trim() || undefined, targetPlayers }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create lobby");
        return;
      }
      router.push(`/lobby/${data.id}`);
    } catch (e) {
      alert("Server error creating lobby");
    }
  }

  function handleJoin() {
    const id = joinCode.trim();
    if (!id) return;
    router.push(`/lobby/${id}`);
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete lobby ${id}?`)) return;
    await fetch(`/api/lobbies/${id}`, { method: "DELETE" });
    refreshLobbies();
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">Anime Character Draft</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4">
            <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Create Lobby</div>
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white mb-2"
              placeholder="Host name (optional)"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
            />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-neutral-400">Players:</span>
              {[2, 4, 8, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => setTargetPlayers(n)}
                  className={`px-2 py-1 rounded border text-xs ${
                    targetPlayers === n ? "border-fuchsia-500" : "border-neutral-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button onClick={handleCreate} className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700">
              Create
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4">
            <div className="text-xs uppercase text-neutral-500 font-semibold mb-2">Join Lobby</div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
                placeholder="Lobby code (e.g. 3)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button onClick={handleJoin} className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm hover:bg-neutral-700">
                Go
              </button>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase text-neutral-500 font-semibold">Past Drafts</div>
            <button onClick={refreshLobbies} className="text-xs text-neutral-400 hover:text-neutral-200">Refresh</button>
          </div>
          {loading ? (
            <div className="text-xs text-neutral-500">Loading…</div>
          ) : lobbies.length === 0 ? (
            <div className="text-xs text-neutral-600">No lobbies yet</div>
          ) : (
            <div className="grid gap-2">
              {lobbies.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded p-2">
                  <div className="text-sm">
                    <span className="text-white font-semibold">#{m.id}</span>
                    <span className="text-neutral-500 text-xs ml-2">{m.status}</span>
                    <span className="text-neutral-500 text-xs ml-2">players: {m.playersCount}</span>
                    {m.hostName && <span className="text-neutral-500 text-xs ml-2">host: {m.hostName}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => router.push(`/lobby/${m.id}`)} className="text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1 hover:bg-neutral-700">Open</button>
                    <button onClick={() => handleDelete(m.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

