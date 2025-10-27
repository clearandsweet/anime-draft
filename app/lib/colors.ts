export const COLOR_MAP: Record<
  string,
  { glow: string; text: string; border: string; ring: string; overlay: string }
> = {
  rose: {
    glow: "shadow-[0_0_10px_rgba(244,63,94,0.5)]",
    text: "text-rose-400",
    border: "border-rose-500",
    ring: "ring-rose-500/60 shadow-[0_0_16px_rgba(244,63,94,0.5)]",
    overlay: "bg-rose-500/70",
  },
  sky: {
    glow: "shadow-[0_0_10px_rgba(14,165,233,0.5)]",
    text: "text-sky-400",
    border: "border-sky-500",
    ring: "ring-sky-500/60 shadow-[0_0_16px_rgba(14,165,233,0.5)]",
    overlay: "bg-sky-500/70",
  },
  emerald: {
    glow: "shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    text: "text-emerald-400",
    border: "border-emerald-500",
    ring: "ring-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.5)]",
    overlay: "bg-emerald-500/70",
  },
  amber: {
    glow: "shadow-[0_0_10px_rgba(251,191,36,0.5)]",
    text: "text-amber-400",
    border: "border-amber-500",
    ring: "ring-amber-400/60 shadow-[0_0_16px_rgba(251,191,36,0.5)]",
    overlay: "bg-amber-500/70",
  },
  fuchsia: {
    glow: "shadow-[0_0_10px_rgba(217,70,239,0.5)]",
    text: "text-fuchsia-400",
    border: "border-fuchsia-500",
    ring: "ring-fuchsia-500/60 shadow-[0_0_16px_rgba(217,70,239,0.5)]",
    overlay: "bg-fuchsia-500/70",
  },
  indigo: {
    glow: "shadow-[0_0_10px_rgba(99,102,241,0.5)]",
    text: "text-indigo-400",
    border: "border-indigo-500",
    ring: "ring-indigo-500/60 shadow-[0_0_16px_rgba(99,102,241,0.5)]",
    overlay: "bg-indigo-500/70",
  },
  lime: {
    glow: "shadow-[0_0_10px_rgba(163,230,53,0.5)]",
    text: "text-lime-400",
    border: "border-lime-500",
    ring: "ring-lime-500/60 shadow-[0_0_16px_rgba(163,230,53,0.5)]",
    overlay: "bg-lime-500/70",
  },
  cyan: {
    glow: "shadow-[0_0_10px_rgba(34,211,238,0.5)]",
    text: "text-cyan-400",
    border: "border-cyan-500",
    ring: "ring-cyan-500/60 shadow-[0_0_16px_rgba(34,211,238,0.5)]",
    overlay: "bg-cyan-500/70",
  },
  default: {
    glow: "shadow-[0_0_10px_rgba(255,255,255,0.15)]",
    text: "text-neutral-300",
    border: "border-neutral-500",
    ring: "ring-neutral-500/60 shadow-[0_0_16px_rgba(255,255,255,0.15)]",
    overlay: "bg-neutral-500/70",
  },
};

export type PlayerColorKey = keyof typeof COLOR_MAP;

export function colorStyleForColor(color?: string | null) {
  if (!color) return COLOR_MAP.default;
  return COLOR_MAP[color] || COLOR_MAP.default;
}
