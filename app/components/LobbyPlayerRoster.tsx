"use client";

import { colorStyleForColor } from "../lib/colors";
import { getDraftReadiness } from "../lib/draftReadiness";

type LobbyPlayerRosterProps = {
  players: Array<{ id: string; name: string; color: string }>;
  hostName: string | null;
  currentPlayerName: string;
  readyPlayerIds: string[];
  canManage: boolean;
  removingPlayerId: string | null;
  updatingReady: boolean;
  onRemovePlayer: (playerId: string, playerName: string) => void;
  onToggleReady: (ready: boolean) => void;
};

export function LobbyPlayerRoster({
  players,
  hostName,
  currentPlayerName,
  readyPlayerIds,
  canManage,
  removingPlayerId,
  updatingReady,
  onRemovePlayer,
  onToggleReady,
}: LobbyPlayerRosterProps) {
  const readiness = getDraftReadiness(players, readyPlayerIds);
  const readySet = new Set(readiness.readyPlayerIds);

  return (
    <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase text-neutral-500">
          Players
        </div>
        <div
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            readiness.allReady
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          {readiness.readyCount}/{readiness.playerCount} ready
        </div>
      </div>

      <div className="space-y-2">
        {players.map((player) => {
          const playerStyles = colorStyleForColor(player.color);
          const isHost =
            Boolean(hostName) &&
            player.name.toLowerCase() === hostName?.toLowerCase();
          const isCurrentPlayer =
            Boolean(currentPlayerName.trim()) &&
            player.name.toLowerCase() ===
              currentPlayerName.trim().toLowerCase();
          const isReady = readySet.has(player.id);
          const isRemoving = removingPlayerId === player.id;

          return (
            <div
              key={player.id}
              className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2"
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-neutral-950 text-xs font-bold ${playerStyles.border} ${playerStyles.text}`}
              >
                {player.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-200">
                {player.name}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                {isHost && (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                    Host
                  </span>
                )}
                {isCurrentPlayer ? (
                  <button
                    type="button"
                    aria-pressed={isReady}
                    disabled={updatingReady}
                    onClick={() => onToggleReady(!isReady)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                      isReady
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                        : "border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                    }`}
                  >
                    {updatingReady
                      ? "Saving…"
                      : isReady
                        ? "Ready ✓"
                        : "I’m Ready"}
                  </button>
                ) : (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      isReady
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-neutral-700 bg-neutral-950 text-neutral-500"
                    }`}
                  >
                    {isReady ? "Ready" : "Not ready"}
                  </span>
                )}
                {!isHost && canManage && (
                  <button
                    type="button"
                    aria-label={`Remove ${player.name} from the room`}
                    disabled={Boolean(removingPlayerId)}
                    onClick={() => onRemovePlayer(player.id, player.name)}
                    className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-50"
                  >
                    {isRemoving ? "Removing…" : "Remove"}
                  </button>
                )}
              </span>
            </div>
          );
        })}

        {!players.length && (
          <div className="rounded-lg border border-dashed border-neutral-700 px-3 py-5 text-center text-xs text-neutral-500">
            No players yet
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Each player marks themselves ready. The host can still launch a test
        room before everyone checks in.
        {canManage && players.length > 1
          ? " Remove accidental entries here; they can rejoin while the lobby is open."
          : ""}
      </p>
    </div>
  );
}
