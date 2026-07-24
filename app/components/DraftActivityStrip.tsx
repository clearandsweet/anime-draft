import type { LobbyState } from "../api/lobby/logic";
import { colorStyleForColor } from "../lib/colors";
import {
  getCompletedPickCount,
  getRecentDraftActivity,
} from "../lib/draftActivity";

type DraftActivityStripProps = {
  lobby: LobbyState;
  draftType: "anime" | "pokemon";
};

export function DraftActivityStrip({
  lobby,
  draftType,
}: DraftActivityStripProps) {
  const activity = getRecentDraftActivity(lobby, 5);
  const completedPicks = getCompletedPickCount(lobby.history);
  const isPokemon = draftType === "pokemon";
  const latestBorder = isPokemon ? "border-red-500/60" : "border-fuchsia-500/60";
  const latestBackground = isPokemon ? "bg-red-500/10" : "bg-fuchsia-500/10";

  return (
    <section
      className="min-w-[260px] flex-1"
      aria-label="Recent draft activity"
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Recent picks
        </div>
        <div className="text-[10px] text-neutral-600">
          {completedPicks} {completedPicks === 1 ? "pick" : "picks"} made
        </div>
      </div>

      {activity.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {activity.map((event, index) => {
            const palette = colorStyleForColor(event.playerColor);
            const isLatest = index === 0;

            return (
              <article
                key={event.eventNumber}
                className={`flex min-w-[210px] items-center gap-2 rounded-lg border p-2 ${
                  event.isSkip
                    ? "border-amber-500/40 bg-amber-500/10"
                    : isLatest
                      ? `${latestBorder} ${latestBackground}`
                      : "border-neutral-800 bg-neutral-900/80"
                }`}
                aria-label={
                  event.isSkip
                    ? `${event.playerName}'s turn was skipped`
                    : `${event.playerName} picked ${event.characterName} for ${event.slot}`
                }
              >
                <div
                  aria-hidden="true"
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 bg-center ${
                    isPokemon ? "bg-contain bg-no-repeat" : "bg-cover"
                  } text-[9px] font-bold uppercase text-amber-300`}
                  style={
                    event.imageUrl
                      ? { backgroundImage: `url(${event.imageUrl})` }
                      : undefined
                  }
                >
                  {!event.imageUrl && (event.isSkip ? "Skip" : "?")}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                    <span>
                      {event.isSkip
                        ? `Turn ${event.eventNumber}`
                        : `Pick ${event.pickNumber}`}
                    </span>
                    {event.round && <span>R{event.round}</span>}
                    {isLatest && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-white">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs font-bold text-white">
                    {event.characterName}
                  </div>
                  <div className="truncate text-[10px] text-neutral-400">
                    <span className={palette.text}>{event.playerName}</span>
                    <span aria-hidden="true"> · </span>
                    {event.slot}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 px-3 py-3 text-xs text-neutral-600">
          The first pick will appear here.
        </div>
      )}
    </section>
  );
}
