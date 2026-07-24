"use client";

import { useEffect, useRef } from "react";
import {
  getDraftPreflight,
  type DraftPreflightPreset,
} from "../lib/draftPreflight";

type DraftStartReviewDialogProps = {
  open: boolean;
  draftType: "anime" | "pokemon";
  players: Array<{ id: string; name: string; color: string }>;
  slotNames: string[];
  preset?: DraftPreflightPreset;
  timerDuration?: number;
  onCancel: () => void;
  onConfirm: () => void;
};

const accentStyles = {
  anime: {
    eyebrow: "text-fuchsia-300",
    border: "border-fuchsia-400/40",
    panel: "bg-fuchsia-500/10",
    button:
      "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30 focus:ring-fuchsia-400",
  },
  pokemon: {
    eyebrow: "text-red-300",
    border: "border-red-400/40",
    panel: "bg-red-500/10",
    button:
      "border-red-400 bg-red-500/20 text-red-100 hover:bg-red-500/30 focus:ring-red-400",
  },
} as const;

export function DraftStartReviewDialog({
  open,
  draftType,
  players,
  slotNames,
  preset,
  timerDuration,
  onCancel,
  onConfirm,
}: DraftStartReviewDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const styles = accentStyles[draftType];
  const summary = getDraftPreflight({
    playerNames: players.map((player) => player.name),
    slotNames,
    preset,
    timerDuration,
  });

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancelRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  const draftLabel = draftType === "pokemon" ? "Pokémon" : "anime character";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-start-review-title"
        aria-describedby="draft-start-review-description"
        className={`max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border ${styles.border} bg-neutral-950 shadow-2xl`}
      >
        <div className="border-b border-neutral-800 p-5 sm:p-6">
          <div
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${styles.eyebrow}`}
          >
            Host preflight
          </div>
          <h2
            id="draft-start-review-title"
            className="mt-2 text-2xl font-bold text-white"
          >
            Ready to launch this draft?
          </h2>
          <p
            id="draft-start-review-description"
            className="mt-2 text-sm leading-relaxed text-neutral-400"
          >
            Review the room before the {draftLabel} draft begins. Starting
            locks these settings and randomizes the first-round player order.
          </p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Format", value: summary.presetLabel },
              {
                label: "Players",
                value: String(summary.playerCount),
              },
              {
                label: "Total picks",
                value: String(summary.totalPicks),
              },
              {
                label: "Pick timer",
                value: summary.timerLabel,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  {item.label}
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div
            className={`rounded-xl border ${styles.border} ${styles.panel} p-4`}
          >
            <div className="text-sm font-semibold text-white">
              Up to {summary.maximumClockLabel} on the pick clock
            </div>
            <div className="mt-1 text-xs leading-relaxed text-neutral-400">
              That is {summary.slotsPerPlayer} picks per player if every turn
              uses the full timer. Pauses and between-pick discussion are not
              included.
            </div>
          </div>

          {summary.isSolo && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
              <div className="text-sm font-semibold text-amber-200">
                Solo test run
              </div>
              <div className="mt-1 text-xs leading-relaxed text-amber-100/70">
                This room has one player. You can continue for testing, or
                cancel and invite more people first.
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Players in room
              </div>
              <ol className="mt-3 space-y-2">
                {summary.playerNames.map((name, index) => (
                  <li
                    key={`${name}-${players[index]?.id ?? index}`}
                    className="flex items-center gap-3 text-sm text-neutral-200"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-[11px] text-neutral-400">
                      {index + 1}
                    </span>
                    <span>{name}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 text-[11px] text-neutral-500">
                Listed by join time; draft order randomizes at launch.
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Board categories
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.slotNames.map((slotName) => (
                  <span
                    key={slotName}
                    className="rounded-full border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-[11px] text-neutral-300"
                  >
                    {slotName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-800 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-500"
          >
            Back to Lobby
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 ${styles.button}`}
          >
            Confirm &amp; Start Draft
          </button>
        </div>
      </section>
    </div>
  );
}
