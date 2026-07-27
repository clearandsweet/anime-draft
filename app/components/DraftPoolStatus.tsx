import type { DraftPickAvailability } from "../lib/draftPickAvailability";

type Props = {
  availability: DraftPickAvailability;
  draftType: "anime" | "pokemon";
};

const TONE_STYLES: Record<DraftPickAvailability["tone"], string> = {
  ready: "border-emerald-400/50 bg-emerald-500/10 text-emerald-100",
  waiting: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  paused: "border-amber-400/35 bg-amber-500/10 text-amber-100",
  complete: "border-violet-400/35 bg-violet-500/10 text-violet-100",
  watching: "border-neutral-600 bg-neutral-800/70 text-neutral-200",
  full: "border-cyan-400/35 bg-cyan-500/10 text-cyan-100",
};

export function DraftPoolStatus({ availability, draftType }: Props) {
  const accent =
    draftType === "pokemon" ? "bg-red-400" : "bg-fuchsia-400";

  return (
    <div
      className={`mb-3 flex items-center gap-3 rounded-xl border px-4 py-3 ${TONE_STYLES[availability.tone]}`}
      role="status"
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent} ${
          availability.canPick ? "animate-pulse" : "opacity-60"
        }`}
      />
      <div className="min-w-0">
        <p className="text-sm font-bold">{availability.label}</p>
        <p className="text-xs opacity-70">{availability.detail}</p>
      </div>
    </div>
  );
}
