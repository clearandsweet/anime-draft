"use client";

import { colorStyleForColor } from "../lib/colors";

type LobbyPlayerRosterProps = {
  players: Array<{ id: string; name: string; color: string }>;
  hostName: string | null;
  canManage: boolean;
  removingPlayerId: string | null;
  onRemovePlayer: (playerId: string, playerName: string) => void;
};

export function LobbyPlayerRoster({
  players,
  hostName,
  canManage,
  removingPlayerId,
  onRemovePlayer,
}: LobbyPlayerRosterProps) {
  return (
    <div className="bg-neutral-800/40 border border-neutral-700 rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase text-neutral-500">
          Players
        </div>
        <div className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
          {players.length} {players.length === 1 ? "player" : "players"}
        </div>
      </div>

      <div className="space-y-2">
        {players.map((player) => {
          const playerStyles = colorStyleForColor(player.color);
          const isHost =
            Boolean(hostName) &&
            player.name.toLowerCase() === hostName?.toLowerCase();
          const isRemoving = removingPlayerId === player.id;

          return (
            <div
              key={player.id}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2"
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
              {isHost ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Host
                </span>
              ) : (
                canManage && (
                  <button
                    type="button"
                    aria-label={`Remove ${player.name} from the room`}
                    disabled={Boolean(removingPlayerId)}
                    onClick={() => onRemovePlayer(player.id, player.name)}
                    className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-50"
                  >
                    {isRemoving ? "Removing…" : "Remove"}
                  </button>
                )
              )}
            </div>
          );
        })}

        {!players.length && (
          <div className="rounded-lg border border-dashed border-neutral-700 px-3 py-5 text-center text-xs text-neutral-500">
            No players yet
          </div>
        )}
      </div>

      {canManage && players.length > 1 && (
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
          Remove accidental entries before launch. Removed players can rejoin
          while the lobby is still open.
        </p>
      )}
    </div>
  );
}
