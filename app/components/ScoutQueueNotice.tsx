"use client";

import { useEffect, useRef } from "react";

type ScoutQueueNoticeProps = {
  candidateNames: string[];
  onDismiss: () => void;
};

function summarizeCandidateNames(candidateNames: string[]) {
  if (candidateNames.length <= 1) return candidateNames[0] ?? "A candidate";
  if (candidateNames.length === 2) {
    return `${candidateNames[0]} and ${candidateNames[1]}`;
  }
  return `${candidateNames[0]}, ${candidateNames[1]}, and ${
    candidateNames.length - 2
  } more`;
}

export function ScoutQueueNotice({
  candidateNames,
  onDismiss,
}: ScoutQueueNoticeProps) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timeout = window.setTimeout(() => onDismissRef.current(), 8000);
    return () => window.clearTimeout(timeout);
  }, [candidateNames]);

  const candidateSummary = summarizeCandidateNames(candidateNames);
  const verb = candidateNames.length === 1 ? "was" : "were";

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
    >
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
          Scout queue updated
        </div>
        <p className="mt-1 text-sm leading-5 text-amber-50">
          <strong>{candidateSummary}</strong> {verb} drafted and removed from
          your private queue.
        </p>
        <p className="mt-1 text-[11px] text-amber-200/70">
          Your remaining priorities and category plans were preserved.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss Scout queue update"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-amber-200/70 transition hover:bg-amber-500/15 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
