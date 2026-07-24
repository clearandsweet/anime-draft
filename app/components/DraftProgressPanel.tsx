import type { LobbyState } from "../api/lobby/logic";
import { colorStyleForColor } from "../lib/colors";
import { getDraftProgress } from "../lib/draftProgress";

type DraftProgressPanelProps = {
  lobby: LobbyState;
  viewerName?: string;
  draftType: "anime" | "pokemon";
};

export function DraftProgressPanel({
  lobby,
  viewerName = "",
  draftType,
}: DraftProgressPanelProps) {
  const progress = getDraftProgress(lobby.players);
  if (!progress.totalSlots) return null;

  const viewer = viewerName.trim().toLowerCase();
  const isPokemon = draftType === "pokemon";
  const progressFill = isPokemon
    ? "bg-gradient-to-r from-red-500 to-amber-400"
    : "bg-gradient-to-r from-fuchsia-500 to-violet-400";
  const remainingLabel =
    progress.remainingSlots === 0
      ? "All boards filled"
      : `${progress.remainingSlots} ${
          progress.remainingSlots === 1 ? "pick" : "picks"
        } remaining`;

  return (
    <section
      className="col-span-full rounded-xl border border-neutral-800 bg-neutral-900/70 p-4"
      aria-labelledby="draft-progress-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="draft-progress-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500"
          >
            Draft progress
          </h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white">
              {progress.filledSlots}
              <span className="text-sm text-neutral-500">
                /{progress.totalSlots}
              </span>
            </span>
            <span className="text-xs text-neutral-400">{remainingLabel}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">
            {progress.percentage}%
          </div>
          <div className="text-[10px] text-neutral-500">
            Round {lobby.round}
          </div>
        </div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.totalSlots}
        aria-valuenow={progress.filledSlots}
        aria-label={`${progress.filledSlots} of ${progress.totalSlots} draft slots filled`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${progressFill}`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {progress.players.map((player, index) => {
          const palette = colorStyleForColor(player.color);
          const isViewer = Boolean(
            viewer && player.name.trim().toLowerCase() === viewer
          );
          const isOnClock =
            lobby.draftActive && index === lobby.currentPlayerIndex;

          return (
            <div
              key={player.id}
              className={`flex min-w-[150px] items-center justify-between gap-3 rounded-lg border bg-neutral-950/70 px-3 py-2 ${
                isOnClock ? palette.border : "border-neutral-800"
              }`}
              aria-label={`${player.name}: ${player.filledSlots} of ${player.totalSlots} slots filled`}
            >
              <div className="min-w-0">
                <div className={`truncate text-xs font-semibold ${palette.text}`}>
                  {player.name}
                </div>
                <div className="mt-0.5 flex gap-1">
                  {isViewer && (
                    <span className="text-[9px] font-bold uppercase text-emerald-300">
                      You
                    </span>
                  )}
                  {isOnClock && (
                    <span className="text-[9px] font-bold uppercase text-white">
                      On clock
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-white">
                  {player.filledSlots}/{player.totalSlots}
                </div>
                <div className="text-[9px] text-neutral-600">slots</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
