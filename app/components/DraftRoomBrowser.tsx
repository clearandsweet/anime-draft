"use client";

import type { DraftPreset } from "./DraftPresetPicker";

export type LobbyMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  hostName: string | null;
  status: "active" | "completed";
  playersCount: number;
  lastPickAt: string | null;
  preset?: DraftPreset;
};

type Props = {
  lobbies: LobbyMeta[];
  loading: boolean;
  basePath: "/lobby" | "/pokemon-lobby";
  accent: "fuchsia" | "red";
  onDelete: (id: string) => void;
};

const PRESET_LABELS: Record<DraftPreset, string> = {
  classic: "Classic",
  blitz: "Blitz",
  chaos: "Chaos",
};

function formatDate(value: string | null) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function RoomCard({
  lobby,
  basePath,
  accent,
  onDelete,
}: Omit<Props, "lobbies" | "loading"> & { lobby: LobbyMeta }) {
  const completed = lobby.status === "completed";
  const preset = lobby.preset ?? "classic";
  const primaryClass =
    accent === "fuchsia"
      ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25"
      : "border-red-500/50 bg-red-500/15 text-red-100 hover:bg-red-500/25";

  return (
    <article className="group rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 transition hover:border-neutral-700">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-white">Room #{lobby.id}</h4>
            <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-300">
              {PRESET_LABELS[preset]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                completed
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-200"
              }`}
            >
              {completed ? "Final" : "Live"}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Hosted by {lobby.hostName || "anonymous"} · {lobby.playersCount}{" "}
            {lobby.playersCount === 1 ? "player" : "players"}
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            Updated {formatDate(lobby.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={completed ? `${basePath}/${lobby.id}/vote` : `${basePath}/${lobby.id}`}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${primaryClass}`}
          >
            {completed ? "Results & recap" : "Enter room"}
          </a>
          {completed && (
            <a
              href={`${basePath}/${lobby.id}`}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 transition hover:bg-neutral-800"
            >
              Draft board
            </a>
          )}
          <button
            type="button"
            onClick={() => onDelete(lobby.id)}
            className="rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300 transition hover:bg-red-950/40"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

export function DraftRoomBrowser({ lobbies, loading, basePath, accent, onDelete }: Props) {
  const active = lobbies.filter((lobby) => lobby.status === "active");
  const completed = lobbies.filter((lobby) => lobby.status === "completed");

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 text-sm text-neutral-500">
        Loading rooms…
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-300">Now drafting</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Live rooms</h3>
          </div>
          <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs text-neutral-400">
            {active.length}
          </span>
        </div>
        <div className="space-y-3">
          {active.length ? (
            active.map((lobby) => (
              <RoomCard
                key={lobby.id}
                lobby={lobby}
                basePath={basePath}
                accent={accent}
                onDelete={onDelete}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-800 p-5 text-sm text-neutral-500">
              No live rooms. Start the next one above.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Never auto-deleted</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Draft history</h3>
          </div>
          <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs text-neutral-400">
            {completed.length}
          </span>
        </div>
        <div className="space-y-3">
          {completed.length ? (
            completed.map((lobby) => (
              <RoomCard
                key={lobby.id}
                lobby={lobby}
                basePath={basePath}
                accent={accent}
                onDelete={onDelete}
              />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-800 p-5 text-sm text-neutral-500">
              Completed drafts will collect here with their boards, votes, and results.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
