"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { LobbyState } from "../api/lobby/logic";
import { colorStyleForColor } from "../lib/colors";
import {
  getDraftUndoPreview,
  type DraftUndoExpectation,
  type DraftUndoPreview,
} from "../lib/draftUndo";

type UndoActionResult = {
  ok: boolean;
  error?: string;
};

type HostUndoControlProps = {
  lobby: LobbyState;
  draftType: "anime" | "pokemon";
  onUndo: (
    expectation: DraftUndoExpectation
  ) => Promise<UndoActionResult>;
};

export function HostUndoControl({
  lobby,
  draftType,
  onUndo,
}: HostUndoControlProps) {
  const currentPreview = getDraftUndoPreview(lobby);
  const [pendingPreview, setPendingPreview] =
    useState<DraftUndoPreview | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const isPokemon = draftType === "pokemon";

  useEffect(() => {
    if (!pendingPreview) return;

    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !undoing) {
        setPendingPreview(null);
        setError("");
        window.setTimeout(() => triggerRef.current?.focus(), 0);
        return;
      }

      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)"
        ) ?? []
      );
      if (!controls.length) return;

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingPreview, undoing]);

  function closeDialog() {
    if (undoing) return;
    setPendingPreview(null);
    setError("");
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function confirmUndo() {
    if (!pendingPreview || undoing) return;
    setUndoing(true);
    setError("");

    const result = await onUndo(pendingPreview.expectation);
    setUndoing(false);

    if (!result.ok) {
      setError(result.error || "The last draft action could not be undone.");
      return;
    }

    setPendingPreview(null);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  const accentButton = isPokemon
    ? "hover:border-red-400/70 hover:text-red-200 focus-visible:ring-red-400"
    : "hover:border-fuchsia-400/70 hover:text-fuchsia-200 focus-visible:ring-fuchsia-400";
  const confirmButton = isPokemon
    ? "bg-red-600 hover:bg-red-500 focus-visible:ring-red-400"
    : "bg-fuchsia-600 hover:bg-fuchsia-500 focus-visible:ring-fuchsia-400";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={!currentPreview}
        title={currentPreview ? "Review the last draft action" : "No draft actions to undo"}
        onClick={() => {
          if (!currentPreview) return;
          setPendingPreview(currentPreview);
          setError("");
        }}
        className={`rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm text-neutral-200 transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${accentButton}`}
      >
        {currentPreview?.kind === "skip" ? "Undo skipped turn" : "Undo last pick"}
      </button>

      {pendingPreview && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="undo-draft-title"
            aria-describedby="undo-draft-description"
            className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
                {pendingPreview.imageUrl ? (
                  <Image
                    src={pendingPreview.imageUrl}
                    alt={`${pendingPreview.characterName} portrait`}
                    width={64}
                    height={80}
                    unoptimized
                    className={
                      isPokemon
                        ? "h-full w-full object-contain"
                        : "h-full w-full object-cover"
                    }
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="text-xs font-bold uppercase tracking-wider text-amber-300"
                  >
                    Skip
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Host safeguard
                </div>
                <h2 id="undo-draft-title" className="text-xl font-bold text-white">
                  {pendingPreview.kind === "skip"
                    ? "Undo this skipped turn?"
                    : `Undo ${pendingPreview.characterName}?`}
                </h2>
                <p
                  id="undo-draft-description"
                  className="mt-2 text-sm leading-6 text-neutral-400"
                >
                  {pendingPreview.kind === "skip" ? (
                    <>
                      This restores{" "}
                      <span className={colorStyleForColor(pendingPreview.playerColor).text}>
                        {pendingPreview.playerName}
                      </span>
                      &apos;s turn after the timer expired.
                    </>
                  ) : (
                    <>
                      This removes <strong className="text-neutral-200">{pendingPreview.characterName}</strong>{" "}
                      from{" "}
                      <span className={colorStyleForColor(pendingPreview.playerColor).text}>
                        {pendingPreview.playerName}
                      </span>
                      &apos;s <strong className="text-neutral-200">{pendingPreview.slot}</strong> slot.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-100">
              {pendingPreview.reopensCompletedDraft && (
                <span className="block font-semibold">
                  This completed draft will reopen.
                </span>
              )}
              The player&apos;s turn returns with a fresh timer, which starts immediately.
              No earlier picks will change.
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                disabled={undoing}
                onClick={closeDialog}
                className="rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-50"
              >
                {error ? "Review latest action" : "Keep draft as-is"}
              </button>
              <button
                type="button"
                disabled={undoing}
                onClick={confirmUndo}
                className={`rounded-lg px-4 py-2.5 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60 ${confirmButton}`}
              >
                {undoing ? "Undoing..." : "Undo and restore turn"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
