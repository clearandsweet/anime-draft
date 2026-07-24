import React from "react";
import { LobbyState } from "../api/lobby/logic";
import { colorStyleForColor } from "../lib/colors";
import { getUpcomingDraftTurns } from "../lib/draftTurns";

type Props = {
  lobby: LobbyState;
  viewerName?: string;
};

export function DraftTurnGuide({ lobby, viewerName = "" }: Props) {
  if (!lobby.draftActive || lobby.players.length === 0) return null;

  const viewer = viewerName.trim().toLowerCase();
  const currentPlayer = lobby.players[lobby.currentPlayerIndex] || null;
  const upcomingTurns = getUpcomingDraftTurns(
    lobby.players.length,
    lobby.currentPlayerIndex,
    lobby.round,
    4
  );

  return (
    <div
      className="border-t border-neutral-800 bg-neutral-900/70 px-3 py-2"
      aria-label="Upcoming draft turns"
    >
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Up next
        </span>
        {upcomingTurns.map((turn, index) => {
          const player = lobby.players[turn.playerIndex];
          if (!player) return null;

          const palette = colorStyleForColor(player.color);
          const isViewer = Boolean(
            viewer && player.name.trim().toLowerCase() === viewer
          );
          const isBackToBack =
            index === 0 && player.id === currentPlayer?.id;

          return (
            <div
              key={`${turn.round}-${turn.playerIndex}-${index}`}
              className={`shrink-0 rounded-lg border bg-neutral-950/80 px-3 py-1.5 ${palette.border}`}
              aria-label={`${isBackToBack ? "Back-to-back pick" : `Pick ${index + 1}`}: ${player.name}, round ${turn.round}`}
            >
              <div className="flex items-center gap-2 leading-none">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                  {isBackToBack
                    ? "Back-to-back"
                    : index === 0
                      ? "Next"
                      : `+${index + 1}`}
                </span>
                <span className={`text-xs font-semibold ${palette.text}`}>
                  {player.name}
                </span>
                {isViewer && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                    You
                  </span>
                )}
                <span className="text-[10px] text-neutral-600">R{turn.round}</span>
              </div>
            </div>
          );
        })}
        <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
          Snake order reverses each round
        </span>
      </div>
    </div>
  );
}
