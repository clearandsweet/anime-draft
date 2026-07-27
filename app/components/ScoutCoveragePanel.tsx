"use client";

import { useState } from "react";
import type { DraftScoutCoverage } from "../lib/draftShortlist";

type Props = {
  coverage: DraftScoutCoverage;
  focusedSlotName: string;
  onFocusSlot: (slotName: string) => void;
  onClearQueue: () => void;
};

export function ScoutCoveragePanel({
  coverage,
  focusedSlotName,
  onFocusSlot,
  onClearQueue,
}: Props) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  if (!coverage.queuedCandidateCount) return null;

  return (
    <section
      className="mb-3 rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/35 via-neutral-900/90 to-neutral-900/90 p-4"
      aria-labelledby="scout-coverage-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Private Scout plan
          </p>
          <h3
            id="scout-coverage-title"
            className="mt-1 text-sm font-bold text-white"
          >
            {coverage.coveredSlotCount} of {coverage.openSlotCount} open{" "}
            {coverage.openSlotCount === 1 ? "category" : "categories"} covered
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-neutral-700 bg-neutral-950/70 px-3 py-1 text-[10px] text-neutral-400">
            {coverage.queuedCandidateCount} queued
          </div>
          <button
            type="button"
            aria-expanded={confirmingClear}
            onClick={() => setConfirmingClear(true)}
            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-500/20"
          >
            Clear queue
          </button>
        </div>
      </div>

      {confirmingClear && (
        <div
          className="mt-3 rounded-xl border border-rose-500/35 bg-rose-950/30 p-3"
          role="group"
          aria-label="Confirm clearing Scout queue"
        >
          <p className="text-xs font-semibold text-rose-100">
            Clear all {coverage.queuedCandidateCount} private Scout{" "}
            {coverage.queuedCandidateCount === 1 ? "candidate" : "candidates"}?
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-rose-100/65">
            This removes the queue and its category plans from this device only.
            Shared draft picks and room history will not change.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
            >
              Keep queue
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingClear(false);
                onClearQueue();
              }}
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400"
            >
              Clear private queue
            </button>
          </div>
        </div>
      )}

      {coverage.openSlotCount > 0 ? (
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Focus Scout queue by planned category"
        >
          <button
            type="button"
            aria-pressed={!focusedSlotName}
            onClick={() => onFocusSlot("")}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
              !focusedSlotName
                ? "border-amber-400 bg-amber-500/20 text-amber-100"
                : "border-neutral-700 bg-neutral-950/70 text-neutral-400 hover:border-amber-500/50"
            }`}
          >
            All queue
          </button>
          {coverage.slots.map((slot) => (
            <button
              type="button"
              key={slot.name}
              disabled={slot.candidateCount === 0}
              aria-pressed={focusedSlotName === slot.name}
              onClick={() => onFocusSlot(slot.name)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                focusedSlotName === slot.name
                  ? "border-amber-400 bg-amber-500/20 text-amber-100"
                  : slot.candidateCount > 0
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/60"
                    : "cursor-not-allowed border-neutral-700 bg-neutral-950/70 text-neutral-600"
              }`}
              aria-label={`${slot.name}: ${
                slot.candidateCount > 0
                  ? `${slot.candidateCount} planned ${
                      slot.candidateCount === 1 ? "candidate" : "candidates"
                    }`
                  : "no planned candidates"
              }`}
            >
              {slot.name}
              <span className="ml-1.5 opacity-70">
                {slot.candidateCount > 0 ? slot.candidateCount : "gap"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">
          Your board has no open categories.
        </p>
      )}

      {coverage.needsOpenPlanCount > 0 && coverage.openSlotCount > 0 && (
        <p className="mt-3 text-xs text-amber-100/70">
          {coverage.needsOpenPlanCount} queued{" "}
          {coverage.needsOpenPlanCount === 1 ? "candidate needs" : "candidates need"}{" "}
          an open-category plan.
        </p>
      )}
    </section>
  );
}
